import { Button } from "@nx.js/constants";
import config from '../src/config.json'

const colors = {
  bgColor: '#2d2d2d',
  sidebar: '#323232',
  select: {
    text: '#00ffc5',
    border: '#74deeb',
  },
  text: '#fff',
  notes: '#9f9f9f'
}

let ctx = screen.getContext('2d');

const height = {
  topBar: screen.height * 0.1216666667,
  sideBar: screen.height * 0.7783333333
    // bottomBar: screen.height * 0.8986111111
}

const width = {
  sideBar: screen.width * 0.3203125,
  content:  screen.width * 0.367109375
}

let currentPath = 'sdmc:/switch/UE4cfgdumper';
let currentIndex = 0;
let files = [];

// Cache filtered files
let visibleFiles = [];

const inputCooldown = 200; // milliseconds
let lastInputTime = 0;

const isValid = {
  titleID: (titleID) => {
    return /^01[0-9A-Fa-f]{11}000$/.test(titleID)
  },
  BID: (bid) => {
    return /^[0-9A-Fa-f]{16}$/.test(bid)
  },
  config: (config) => {
    if (!config.cheatOptions || !Array.isArray(config.cheatOptions)) {
      console.error('Invalid config: missing or invalid "cheatOptions"');
      return false;
    }
    return true;
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
  scrollOffset = 0;
  currentIndex = 0;
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

// Function to navigate to the next file
function navigateToNextFile() {
  if (currentIndex < visibleFiles.length - 1) {
    currentIndex += 1;

    // Check if the new index exceeds the visible range and adjust scroll
    if (currentIndex >= scrollOffset + maxVisibleFiles) {
      scrollOffset += 1; // Scroll down
    }

    drawList();
  }
}

// Function to navigate to the previous file
function navigateToPreviousFile() {
  if (currentIndex > 0) {
    currentIndex -= 1;
    // Check if the new index is before the visible range and adjust scroll
    if (currentIndex < scrollOffset) {
      scrollOffset -= 1; // Scroll up
    }

    drawList();
  }
}

// Function to navigate to a specific directory
function navigateToDirectory(newDir) {
  currentPath = currentPath + '/' + newDir;
  updateFileList();
  drawList();
}

// Track the current scroll offset (initially 0)
let scrollOffset = 0;
const maxVisibleFiles = 10; // Maximum number of items visible at a time

function drawList() {
  ctx.clearRect(0, 0, screen.width, screen.height);

  // Font
  ctx.font = '20px system-ui';

  // Background 
  ctx.fillStyle = colors.bgColor;
  ctx.fillRect(0, 0, screen.width, screen.height);

  // Top Bar Content
  ctx.fillStyle = colors.text;
  ctx.font = '30px system-ui';
  ctx.fillText('ue4cheatcreator', screen.width * 0.102109375, height.topBar * 0.6);

  // Sidebar
  ctx.fillStyle = colors.sidebar;
  ctx.fillRect(0, height.topBar, width.sideBar, height.sideBar);

  // Top bar bottom line
  ctx.beginPath();
  ctx.moveTo(40, height.topBar);
  ctx.lineTo((screen.width - 40), height.topBar);
  ctx.strokeStyle = colors.text;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Bottom bar top line
  ctx.beginPath();
  ctx.moveTo(40, height.sideBar + height.topBar);
  ctx.lineTo(screen.width - 40, (height.sideBar + height.topBar));
  ctx.strokeStyle = colors.text;
  ctx.lineWidth = 1; 
  ctx.stroke();

  // Bottom Bar Content
  ctx.fillStyle = colors.text;
  ctx.font = '20px system-ui';
  ctx.fillText('Press + to exit', screen.width * 0.102109375, height.sideBar + height.topBar + 50);

  // Draw visible items with scrolling
  const startIndex = scrollOffset;
  const endIndex = Math.min(visibleFiles.length, startIndex + maxVisibleFiles);

  visibleFiles.slice(startIndex, endIndex).forEach((item, index) => {
    const displayText = isValid.titleID(item)
      ? `${new Switch.Application(BigInt(`0x${item}`)).name}`
      : item;
    ctx.fillStyle = currentIndex === (startIndex + index) ? colors.select.text : colors.text; // Highlight current item
    ctx.fillText(displayText, width.content, height.topBar + 60 + index * 50);
  });
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
  if (parsedFile && isValid.config(config)) {
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

    try {
      const filePath = currentPath.replace('switch/UE4cfgdumper', 'atmosphere/contents') + '/cheats/' + name.split('.')[0] + '.txt';
      const encoder = new TextEncoder();
      const encodedResult = encoder.encode(result);

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
  drawList(); // Draw the initial file list
}

initialize()
