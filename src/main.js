import { Button } from "@nx.js/constants";
import config from '../src/config.json'

let currentPath = 'sdmc:/switch/UE4cfgdumper';
let currentIndex = 0;
let files = [];

// Cache filtered files
let visibleFiles = [];

const inputCooldown = 75; // milliseconds
let lastInputTime = 0;

// Validation of title IDs
const isValid = {
  titleID: (titleID) => {
    return /^01[0-9A-Fa-f]{11}000$/.test(titleID)
  },
  BID: (bid) => {
    return /^[0-9A-Fa-f]{16}$/.test(bid)
  }
}

// Function to read directory safely
function readDirectory(path) {
  try {
    const files = Switch.readDirSync(path);
    if (!files) {
      console.error(`Failed to read directory at path: ${path}`);
      return [];
    }
    return files;
  } catch (error) {
    console.error(`Error reading directory at path: ${path}`, error);
    return [];
  }
}

// Function to filter files based on your criteria
function updateVisibleFiles() {
  visibleFiles = files.filter(item => !item.includes('.nro') && !item.includes('.txt'));
}

// Function to update file list after directory change
function updateFileList() {
  files = readDirectory(currentPath) || [];
  updateVisibleFiles();
}

// Handle gamepad input with throttle
async function processGamepadInput() {
  requestAnimationFrame(processGamepadInput)

  const now = Date.now();
  if (now - lastInputTime < inputCooldown) return; // Skip input if it's too soon
  lastInputTime = now;

  const pads = navigator.getGamepads();
  for (const pad of pads) {
    if (!pad) continue;

    if (pad.buttons[Button.A].pressed) {
      handleFileSelection();
    } else if (pad.buttons[Button.B].pressed) {
      navigateToParentDirectory();
    } else if (pad.buttons[Button.Down].pressed) {
      navigateToNextFile();
    } else if (pad.buttons[Button.Up].pressed) {
      navigateToPreviousFile();
    }
  }
}

// Function to handle file selection
async function handleFileSelection() {
  try {
    const selectedItem = visibleFiles[currentIndex];
    if (selectedItem.includes('.log')) {
      const dump = new Switch.FsFile(currentPath + '/' + selectedItem).text();
      const parsedFile = parseLogFile(await dump);
      generateCheats(parsedFile, config, selectedItem);
      updateFileList();
      console.log(`Saved to ${currentPath.replace('switch/UE4cfgdumper', 'atmosphere/contents')}/cheats/${selectedItem.split('.')[0]}.txt`);
      console.log('Press + to exit');
    } else {
      navigateToDirectory(selectedItem);
    }
  } catch (err) {
    console.log('Error during file selection:', err);
  }
}

// Function to navigate to the parent directory
function navigateToParentDirectory() {
  if (currentPath !== 'sdmc:/switch/UE4cfgdumper') {
    currentPath = currentPath.split('/').slice(0, -1).join('/');
    updateFileList();
    drawList();
  }
}

// Function to navigate to next file
function navigateToNextFile() {
  if (currentIndex < visibleFiles.length - 1) {
    currentIndex += 1;
    drawList();
  }
}

// Function to navigate to previous file
function navigateToPreviousFile() {
  if (currentIndex > 0) {
    currentIndex -= 1;
    drawList();
  }
}

// Function to navigate to a specific directory
function navigateToDirectory(newDir) {
  currentPath = currentPath + '/' + newDir;
  updateFileList();
  currentIndex = 0;
  drawList();
}

// Function to draw the list of files
function drawList() {
  let ctx = screen.getContext('2d');
  ctx.clearRect(0, 0, screen.width, screen.height);
  ctx.font = '20px system-ui';

  visibleFiles.forEach((item, index) => {
    const displayText = isValid.titleID(item)
      ? `${item} - ${new Switch.Application(BigInt(`0x${item}`)).name}`
      : item;

    ctx.fillStyle = 'white'
    ctx.fillText('Path: ' + currentPath, 0, 0 + 30);
    ctx.fillStyle = currentIndex === index ? "green" : "white";  // Highlight current item
    ctx.fillText(displayText, 0, 70 + index * 30); // Adjust 'index * 30' for spacing
  });
}

// Validate configuration before using it
function validateConfig(config) {
  if (!config.cheatOptions || !Array.isArray(config.cheatOptions)) {
    console.error('Invalid config: missing or invalid "cheatOptions"');
    return false;
  }
  return true;
}

// Function to parse the log file (for cheat generation)
function parseLogFile (logFile) {
  const processedLogFile = {}

  processedLogFile.uploadedFile = 'log'

  logFile = logFile.trim().split(/\n+/)
  logFile.forEach((data) => {
    try {
      data = data.split(', ')
      const cvar = data[0]
      data = {
        main_offset: data[1].split(': ')[1].split(' ')[0],
        offset: [data[1].split(': ')[1].split(' ')[1], data[1].split(': ')[1].split(' ')[2]],
        type: data[2].split(': ')[1].split(' ')[0],
        value: data[2].split(': ')[1].split(' ')[1],
        hexValue: data[2].split(': ')[1].split(' ')[3]
      }
      processedLogFile[cvar] = data
    } catch (err) {
      processedLogFile.engineVersion = data
    }
  })

  return processedLogFile
}

// Function to generate cheats
function generateCheats(parsedFile, config, name) {
  if (parsedFile && validateConfig(config)) {
    let result = [];
    const instruction = '680F0000';

    for (const i of config.cheatOptions) {
      if (i.options) {
        const options = i.options.filter(option => {
          const [name] = Object.entries(option)[0];
          return parsedFile[name];
        });

        if (options.length > 0) {
          const isDefault = options.some(option => {
            const [name, value] = Object.entries(option)[0];
            if (parsedFile.uploadedFile === 'log') {
              switch (parsedFile[name].type) {
                case 'int':
                  return parsedFile[name] && parsedFile[name].value === value.slice(value.length - parsedFile[name].value.length, value.length);
                case 'float':
                  return parsedFile[name] && parsedFile[name].hexValue === `0x${value.split(' ')[1]}`;
              }
            }
          });

          const cheatName = isDefault ? '* ' + i.name : i.name;
          result.push(`[${cheatName}]`);

          options.forEach(option => {
            const [name, value] = Object.entries(option)[0];
            if (parsedFile[name] && parsedFile[name].main_offset) {
              result.push(`580F0000 ${parsedFile[name].main_offset.split('x')[1].padStart(8, '0')}`);
              result.push(`${instruction} ${value.padStart(8, '0')}`);
            }
          });
          result.push(''); // add newline after each section
        } else {
          console.log('Offset not found in dump: ', i.name);
        }
      } else {
        console.log('Missing options in config: ', i.name);
      }
    }

    // Convert the result array to a string
    result = result.join('\n');

    // Write to file in UTF-8
    try {
      const filePath = currentPath.replace('switch/UE4cfgdumper', 'atmosphere/contents') + '/cheats/' + name.split('.')[0] + '.txt';
      const encoder = new TextEncoder(); // Create a new TextEncoder for UTF-8 encoding
      const encodedResult = encoder.encode(result); // Encode the result string

      // Writing the encoded result
      Switch.writeFileSync(filePath, encodedResult);
      console.log('Cheats generated for:', name.split('.')[0]);
    } catch (err) {
      console.log('Failed to generate cheats: ', err);
    }
  }
}

// Initialization
function initialize() {
  processGamepadInput()
  updateFileList(); // Initialize file list
  drawList();       // Draw the initial file list
}

initialize()
