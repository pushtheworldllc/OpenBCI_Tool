'use strict';
const electron = require('electron');
const app = electron.app;

// adds debug features like hotkeys for triggering dev tools and reload
require('electron-debug')();

// prevent window being garbage collected
let mainWindow;

function onClosed() {
	// dereference the window
	// for multiple windows store them in an array
	mainWindow = null;
}

function createMainWindow() {
	const win = new electron.BrowserWindow({
		width: 600,
		height: 400
	});

	win.loadURL(`file://${__dirname}/index.html`);
	win.on('closed', onClosed);

	return win;
}

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('activate', () => {
	if (!mainWindow) {
		mainWindow = createMainWindow();
	}
});

app.on('ready', () => {
	mainWindow = createMainWindow();

	mainWindow.openDevTools();
});

const kStreamStart = '/stream/start';
const kStreamStop = '/stream/stop';
const kConnectBegin = '/connect/begin';
const kConnectEnd = '/connect/end';

const dgram = require('dgram');
const server = dgram.createSocket('udp4');

var clientAddress = '';
var clientPort = '';
var connected = false;


server.on('error', (err) => {
  console.log(`server error:\n${err.stack}`);
  server.close();
});

server.on('message', (msg, rinfo) => {
  	console.log(`server got: ${msg} from ${rinfo.address}:${rinfo.port}`);


	switch (msg) {
		case kStreamStart:
			streamStart();
			break;
		case kStreamStop:
			streamStop();
			break;
		case kConnectBegin:
			clientAddress = info.address;
			clientPort = rinfo.port;
			connected = true;
			connect();
			break;
		case kConnectEnd:
		default:
			clientAddress = '';
			clientPort = '';
			connected = false;
			disconnect();
			break;

	}
});

server.on('listening', () => {
  var address = server.address();
  console.log(`server listening ${address.address}:${address.port}`);
});

server.bind(41234);

var OpenBCIBoard = require('openbci-sdk');

var board = new OpenBCIBoard.OpenBCIBoard({
    verbose: true // This is great for debugging
});

function connect () {
	console.log("Conenct fired");
	board.autoFindOpenBCIBoard()
	    .then(onBoardFind)
	    .catch(function () { // If a board is not found...
	        // This is specially helpful if you don't have a BCI and want to get some simulated data
			board.connect(OpenBCIBoard.OpenBCIConstants.OBCISimulatorPortName)
				.then(onBoardConnect);
	    });
}

function disconnect () {
	board.disconnect();
}

// This function will be called when a board is found
function onBoardFind (portName) {
    // The serial port's name
    if (portName) {
        console.log('board found', portName);
        board.connect(portName)
            .then(onBoardConnect);
    }
}

// This function will be called when the board successfully connects
function onBoardConnect () {
    board.once('ready', () => {
		if (connected) {
			server.send("ready",clientPort,clientAddress);
		} else {
			console.log('ready');
		}
	});

}

// This function will be called when the board is ready to stream data
function streamStart () {
    board.streamStart();
    board.on('sample', onSample);
}

// This function will be called every time a "sample" received from the board
function onSample (sample) {
    // In here we can access 'channelData' from the sample object
    // 'channelData' is an array with 8 values, a value for each channel from the BCI, see example below
    if (connected) {
		server.send(sample,clientPort,clientAddress);
	} else {
		console.log(sample);
	}
}

function streamStop () {
	board.streamStop();
	board.removeListener('sample',onSample);
}
