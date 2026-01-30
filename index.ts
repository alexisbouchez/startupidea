import { Ollama } from 'ollama'
import { BskyAgent, AtpSessionData } from '@atproto/api'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { XMLParser } from 'fast-xml-parser'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

// Configuration
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3'
const BLUESKY_HANDLE = process.env.BLUESKY_HANDLE || ''
const BLUESKY_PASSWORD = process.env.BLUESKY_PASSWORD || ''
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434'
const POST_INTERVAL_MS = 10 * 60 * 1000 // 1 hour
const POST_HISTORY_FILE = 'post_history.json'
const MAX_HISTORY = 100 // Keep last 100 posts to prevent duplicates

// Read and parse the XML prompt
function loadSystemPrompt(): string {
  try {
    const xmlContent = readFileSync('startup_prompt.xml', 'utf-8')
    const parser = new XMLParser({
      ignoreAttributes: false,
      parseTagValue: true
    })
    const parsed = parser.parse(xmlContent)
    
    // Convert the parsed XML back to a formatted string for the LLM
    const instructions = parsed.system_prompt.instructions.instruction
      .map((inst: string) => `- ${inst}`)
      .join('\n')
    
    const examples = parsed.system_prompt.examples.example
      .map((ex: string) => `- ${ex}`)
      .join('\n')
    
    const constraints = parsed.system_prompt.constraints.constraint
      .map((con: string) => `- ${con}`)
      .join('\n')
    
    return `You are a ${parsed.system_prompt.role}. Follow these instructions:\n\n${instructions}\n\nExamples:\n${examples}\n\nConstraints:\n${constraints}\n\nGenerate ONE startup idea now:`
  } catch (error) {
    console.error('Error loading XML prompt:', error)
    return 'Generate a concise startup idea about software, open source, or developer tools. Format: "startup idea: <idea>"'
  }
}

// Initialize Ollama client
const ollama = new Ollama({ host: OLLAMA_HOST })

// Initialize Bluesky agent
let agent: BskyAgent
let session: AtpSessionData | null = null

// Post history management
function loadPostHistory(): string[] {
  try {
    if (!existsSync(POST_HISTORY_FILE)) {
      writeFileSync(POST_HISTORY_FILE, '[]', 'utf-8')
      return []
    }
    const history = JSON.parse(readFileSync(POST_HISTORY_FILE, 'utf-8'))
    return Array.isArray(history) ? history : []
  } catch (error) {
    console.error('Error loading post history:', error)
    return []
  }
}

function savePostHistory(history: string[]): void {
  try {
    // Keep only the most recent posts to prevent file from growing too large
    const limitedHistory = history.slice(-MAX_HISTORY)
    writeFileSync(POST_HISTORY_FILE, JSON.stringify(limitedHistory, null, 2), 'utf-8')
  } catch (error) {
    console.error('Error saving post history:', error)
  }
}

function isDuplicateIdea(idea: string, history: string[]): boolean {
  // Normalize the idea for comparison (remove prefix and trim)
  const normalizedIdea = idea.toLowerCase().replace('startup idea:', '').trim()
  
  return history.some(post => {
    const normalizedPost = post.toLowerCase().replace('startup idea:', '').trim()
    return normalizedPost === normalizedIdea
  })
}

async function initializeBlueskyAgent(): Promise<void> {
  agent = new BskyAgent({ service: 'https://bsky.social' })
  
  try {
    await agent.login({
      identifier: BLUESKY_HANDLE,
      password: BLUESKY_PASSWORD
    })
    
    session = agent.session
    console.log('Successfully logged in to Bluesky')
  } catch (error) {
    console.error('Failed to login to Bluesky:', error)
    throw error
  }
}

// Generate startup idea using Ollama
async function generateStartupIdea(history: string[] = []): Promise<string> {
  const systemPrompt = loadSystemPrompt()
  
  let attempts = 0
  const maxAttempts = 5
  
  while (attempts < maxAttempts) {
    attempts++
    
    try {
      const response = await ollama.generate({
        model: OLLAMA_MODEL,
        prompt: systemPrompt,
        stream: false,
        options: {
          temperature: 0.7 + (attempts * 0.1), // Increase creativity on retries
          num_predict: 100 // Limit to keep responses short
        }
      })
      
      // Clean up the response to ensure proper formatting
      let idea = response.response.trim()
      
      // Ensure it starts with "startup idea: " and is lowercase
      if (!idea.toLowerCase().startsWith('startup idea:')) {
        idea = `startup idea: ${idea}`
      }
      
      idea = idea.toLowerCase()
      
      // Enforce character limit
      if (idea.length > 140) {
        idea = idea.substring(0, 137) + '...'
      }
      
      // Check for duplicates
      if (!isDuplicateIdea(idea, history)) {
        return idea
      }
      
      console.log(`Duplicate idea detected (attempt ${attempts}/${maxAttempts}), regenerating...`)
      
    } catch (error) {
      console.error('Error generating startup idea:', error)
      // If we're on the last attempt, return fallback
      if (attempts >= maxAttempts) {
        break
      }
    }
  }
  
  // Fallback idea if all attempts fail or generation fails
  const fallbackIdeas = [
    'startup idea: ai-powered terminal that writes code for you',
    'startup idea: git for databases with time-travel debugging',
    'startup idea: open source alternative to notion with local-first sync',
    'startup idea: terminal-based irc client for modern chat platforms',
    'startup idea: self-hosted analytics that respects user privacy'
  ]
  
  // Find first non-duplicate fallback
  for (const fallback of fallbackIdeas) {
    if (!isDuplicateIdea(fallback, history)) {
      return fallback
    }
  }
  
  // If all fallbacks are duplicates, return the first one anyway
  return fallbackIdeas[0]
}

// Post to Bluesky
async function postToBluesky(idea: string): Promise<void> {
  if (!agent || !session) {
    await initializeBlueskyAgent()
  }
  
  try {
    const postRecord = {
      text: idea,
      createdAt: new Date().toISOString()
    }
    
    await agent.post(postRecord)
    console.log(`Posted: ${idea}`)
    
    // Save to post history
    const history = loadPostHistory()
    history.push(idea)
    savePostHistory(history)
    console.log(`Post saved to history. Total posts: ${history.length}`)
    
  } catch (error) {
    console.error('Error posting to Bluesky:', error)
  }
}

// Main bot function
async function runBot(): Promise<void> {
  console.log('Startup Idea Bot - Running...')
  
  try {
    // Initialize Bluesky agent
    await initializeBlueskyAgent()
    
    // Main loop
    while (true) {
      console.log('Generating new startup idea...')
      const history = loadPostHistory()
      const idea = await generateStartupIdea(history)
      console.log('Generated idea:', idea)
      
      await postToBluesky(idea)
      
      // Wait for next post
      console.log(`Waiting ${POST_INTERVAL_MS / 1000 / 60} minutes until next post...`)
      await new Promise(resolve => setTimeout(resolve, POST_INTERVAL_MS))
    }
  } catch (error) {
    console.error('Bot error:', error)
    process.exit(1)
  }
}

// Start the bot
if (require.main === module) {
  runBot().catch(console.error)
}

export { generateStartupIdea, postToBluesky, runBot, loadSystemPrompt, loadPostHistory, savePostHistory, isDuplicateIdea }
