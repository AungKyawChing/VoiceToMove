// Game variables
let character = null
let gameArea = null
let platforms = []
let score = 0
let highScore = 0
let isJumping = false
let isGameOver = false
let gameInterval = null
let audioContext = null
let analyser = null
let microphone = null
let isListening = false
const gameSpeed = 3
const gravity = 0.5
let jumpForce = 0
const characterX = 50
let characterY = 0
let characterVelocityY = 0
const platformWidth = 100
const platformGap = 150
let lastPlatformX = 0

// DOM elements
const scoreElement = document.getElementById("score")
const highScoreElement = document.getElementById("highScore")
const startButton = document.getElementById("startButton")
const restartButton = document.getElementById("restartButton")
const gameOverScreen = document.getElementById("gameOver")
const finalScoreElement = document.getElementById("finalScore")
const volumeLevelElement = document.getElementById("volumeLevel")

// Initialize the game
function init() {
  character = document.getElementById("character")
  gameArea = document.getElementById("game-area")

  // Load high score from local storage
  highScore = localStorage.getItem("highScore") || 0
  highScoreElement.textContent = highScore

  // Event listeners
  startButton.addEventListener("click", startGame)
  restartButton.addEventListener("click", restartGame)

  // Set initial character position
  characterY = gameArea.offsetHeight - character.offsetHeight - 50
  updateCharacterPosition()
}

// Start the game
async function startGame() {
  if (isGameOver) return

  // Reset game state
  resetGame()

  // Hide start button
  startButton.classList.add("hidden")

  // Initialize audio context for voice detection
  try {
    await setupAudio()

    // Create initial platforms
    createInitialPlatforms()

    // Start game loop
    gameInterval = setInterval(updateGame, 20)
  } catch (error) {
    console.error("Error starting game:", error)
    alert("Could not access microphone. Please allow microphone access and try again.")
    startButton.classList.remove("hidden")
  }
}

// Set up audio context and microphone
async function setupAudio() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)()
  analyser = audioContext.createAnalyser()
  analyser.fftSize = 256

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    microphone = audioContext.createMediaStreamSource(stream)
    microphone.connect(analyser)
    isListening = true

    // Start monitoring volume
    monitorVolume()
  } catch (error) {
    throw new Error("Microphone access denied")
  }
}

// Monitor volume level from microphone
function monitorVolume() {
  if (!isListening) return

  const dataArray = new Uint8Array(analyser.frequencyBinCount)

  function checkVolume() {
    if (!isListening) return

    analyser.getByteFrequencyData(dataArray)

    // Calculate average volume
    let sum = 0
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i]
    }
    const averageVolume = sum / dataArray.length

    // Update volume bar
    const volumePercentage = Math.min(100, averageVolume * 2)
    volumeLevelElement.style.width = volumePercentage + "%"

    // Determine if player is screaming/making noise
    const volumeThreshold = 15
    if (averageVolume > volumeThreshold && !isGameOver) {
      // Apply jump force based on volume
      jumpForce = Math.min(15, averageVolume / 10)
      if (!isJumping) {
        isJumping = true
        characterVelocityY = -jumpForce
      }
    } else {
      isJumping = false
    }

    requestAnimationFrame(checkVolume)
  }

  checkVolume()
}

// Create initial platforms
function createInitialPlatforms() {
  // Clear existing platforms
  platforms.forEach((platform) => platform.remove())
  platforms = []

  // Create starting platform
  const startPlatform = createPlatform(0, gameArea.offsetHeight - 50, 200, true)
  platforms.push(startPlatform)
  lastPlatformX = 200

  // Create additional platforms
  for (let i = 0; i < 5; i++) {
    createNextPlatform()
  }
}

// Create a new platform
function createPlatform(x, y, width, isSafe = false) {
  const platform = document.createElement("div")
  platform.className = "platform " + (isSafe ? "safe-zone" : "danger-zone")
  platform.style.width = width + "px"
  platform.style.left = x + "px"
  platform.style.bottom = y + "px"
  gameArea.appendChild(platform)

  return platform
}

// Create the next platform
function createNextPlatform() {
  const minGap = platformGap
  const maxGap = platformGap + 50
  const gap = Math.floor(Math.random() * (maxGap - minGap + 1)) + minGap

  const minWidth = 80
  const maxWidth = 150
  const width = Math.floor(Math.random() * (maxWidth - minWidth + 1)) + minWidth

  const x = lastPlatformX + gap
  const y = Math.floor(Math.random() * 100) + 50

  const isSafe = Math.random() > 0.3 // 70% chance of safe platform

  const platform = createPlatform(x, y, width, isSafe)
  platforms.push(platform)
  lastPlatformX = x + width

  return platform
}

// Update game state
function updateGame() {
  if (isGameOver) return

  // Apply gravity
  characterVelocityY += gravity
  characterY += characterVelocityY

  // Move platforms to the left
  movePlatforms()

  // Check for collisions
  checkCollisions()

  // Check if character fell off the screen
  if (characterY > gameArea.offsetHeight) {
    endGame()
    return
  }

  // Update character position
  updateCharacterPosition()

  // Update score
  score++
  scoreElement.textContent = score
}

// Move platforms to the left
function movePlatforms() {
  let firstPlatformX = Number.POSITIVE_INFINITY

  platforms.forEach((platform, index) => {
    const platformX = Number.parseInt(platform.style.left) - gameSpeed
    platform.style.left = platformX + "px"

    // Track the leftmost platform
    if (platformX < firstPlatformX) {
      firstPlatformX = platformX
    }

    // Remove platforms that are off-screen
    if (platformX + Number.parseInt(platform.style.width) < 0) {
      platform.remove()
      platforms.splice(index, 1)
    }
  })

  // Create new platforms as needed
  if (lastPlatformX - Math.abs(firstPlatformX) < gameArea.offsetWidth * 1.5) {
    createNextPlatform()
  }
}

// Check for collisions with platforms
function checkCollisions() {
  let isOnPlatform = false

  platforms.forEach((platform) => {
    const platformLeft = Number.parseInt(platform.style.left)
    const platformRight = platformLeft + Number.parseInt(platform.style.width)
    const platformTop = gameArea.offsetHeight - Number.parseInt(platform.style.bottom)

    // Check if character is above the platform and falling
    if (
      characterX + character.offsetWidth > platformLeft &&
      characterX < platformRight &&
      characterY + character.offsetHeight >= platformTop &&
      characterY + character.offsetHeight <= platformTop + 10 &&
      characterVelocityY > 0
    ) {
      // Land on platform
      characterY = platformTop - character.offsetHeight
      characterVelocityY = 0
      isOnPlatform = true

      // Check if it's a danger zone
      if (platform.classList.contains("danger-zone")) {
        endGame()
      }
    }
  })

  return isOnPlatform
}

// Update character position
function updateCharacterPosition() {
  character.style.bottom = gameArea.offsetHeight - characterY - character.offsetHeight + "px"
  character.style.left = characterX + "px"

  // Add visual feedback for jumping
  if (characterVelocityY < 0) {
    character.style.transform = "scale(0.9, 1.1)"
  } else {
    character.style.transform = "scale(1, 1)"
  }
}

// End the game
function endGame() {
  isGameOver = true
  clearInterval(gameInterval)

  // Update high score
  if (score > highScore) {
    highScore = score
    localStorage.setItem("highScore", highScore)
    highScoreElement.textContent = highScore
  }

  // Show game over screen
  finalScoreElement.textContent = score
  gameOverScreen.classList.remove("hidden")
}

// Reset game state
function resetGame() {
  isGameOver = false
  score = 0
  scoreElement.textContent = score
  characterVelocityY = 0
  characterY = gameArea.offsetHeight - character.offsetHeight - 50
  gameOverScreen.classList.add("hidden")

  // Clear platforms
  platforms.forEach((platform) => platform.remove())
  platforms = []
}

// Restart the game
function restartGame() {
  resetGame()
  startGame()
}

// Initialize the game when the page loads
window.addEventListener("load", init)

