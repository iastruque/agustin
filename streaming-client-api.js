'use strict';

import DID_API from './api.json' assert { type: 'json' };
if (DID_API.key == '🤫') alert('Please put your api key inside ./api.json and restart..')
import ENV_WATSON from './env.json' assert { type: 'json' };

const RTCPeerConnection = (window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection).bind(window);

let peerConnection;
let streamId;
let sessionId;
let sessionClientAnswer;
let watsonSessionId;
let watsonAnswer;
let watsonResponseChat;
let mensaje_chat;
let trimmedResponse;

function concatenateTexts(arr) {
  return arr.reduce((result, obj) => {
    const text = obj.text ? obj.text.replace(/undefined/g, ' ') : '';
    return result + text;
  }, '');
}

function splitText(text) {
  // Split the text using both commas and semicolons as delimiters
  const result = text.split(/[;,]/);
  
  // Remove any leading/trailing spaces from each item in the array
  const trimmedResult = result.map(item => item.trim());

  return trimmedResult;
}

function borrarTexto() {
  document.getElementById('mensajechat').value = "";
}

// Obtén una referencia al elemento de carga
const loadingContainer = document.getElementById("loading-container");

// Función para mostrar el elemento de carga
function mostrarCargando() {
  loadingContainer.style.display = "block";
}

// Función para ocultar el elemento de carga
function ocultarCargando() {
  loadingContainer.style.display = "none";
}

const chatContainer = document.getElementById('chat-content');

function addMessageToChat(message, isUser) {
  const messageElement = document.createElement('div');
  messageElement.className = isUser ? 'user-message' : 'api-message';
  messageElement.textContent = message;

  chatContainer.appendChild(messageElement);
  
  // Scroll to the bottom to show the latest message
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function ocultarConnectButton() {
  connectButton.style.display = "none";
}

function alignElementToRight() {
  if (talkButton2) {
    talkButton2.style.float = 'right'; 
  }
}

function formatearCadena(cadena) {
  // Reemplazar comas entre dos números por puntos
  cadena = cadena.replace(/(\d),(?=\d)/g, '$1.');

  // Agregar puntos a los números que no tienen
  cadena = cadena.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
  cadena = cadena.replace(/<br \/>/g, '');

  return cadena;
}


const talkVideo = document.getElementById('talk-video');
talkVideo.setAttribute('playsinline', '');
const peerStatusLabel = document.getElementById('peer-status-label');
const iceStatusLabel = document.getElementById('ice-status-label');
const iceGatheringStatusLabel = document.getElementById('ice-gathering-status-label');
const signalingStatusLabel = document.getElementById('signaling-status-label');

const connectButton = document.getElementById('connect-button');
connectButton.onclick = async () => {
  mostrarCargando();
  if (peerConnection && peerConnection.connectionState === 'connected') {
    ocultarCargando();
    return;
  }


  stopAllStreams();
  closePC();

  const sessionResponse = await fetch(`${DID_API.url}/talks/streams`, {
    method: 'POST',
    headers: {'Authorization': `Basic ${DID_API.key}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({
      source_url: "https://respaldos-bech.s3.ap.cloud-object-storage.appdomain.cloud/agustin_2048.png"
    }),
  });

  const watsonSession = await fetch(`${ENV_WATSON.ASSISTANT_URL}/v2/assistants/${ENV_WATSON.ASSISTANT_ID}/sessions?version=2023-06-15`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`apikey:${ENV_WATSON.ASSISTANT_KEY}`)
    }
  })

  const { id: newStreamId, offer, ice_servers: iceServers, session_id: newSessionId } = await sessionResponse.json()
  streamId = newStreamId;
  sessionId = newSessionId;

  console.log(`stream id: ${streamId}`);

  const { session_id: newWatsonSessionId } = await watsonSession.json()
  watsonSessionId = newWatsonSessionId;

  console.log(watsonSessionId);
  ocultarCargando();
  ocultarConnectButton();
  alignElementToRight();
  
  try {
    sessionClientAnswer = await createPeerConnection(offer, iceServers);
  } catch (e) {
    console.log('error during streaming setup', e);
    stopAllStreams();
    closePC();
    ocultarCargando();
    return;
  }

  const sdpResponse = await fetch(`${DID_API.url}/talks/streams/${streamId}/sdp`,
    {
      method: 'POST',
      headers: {Authorization: `Basic ${DID_API.key}`, 'Content-Type': 'application/json'},
      body: JSON.stringify({answer: sessionClientAnswer, session_id: sessionId})
    });
    
};

const talkButton2 = document.getElementById('talk-button2');
talkButton2.onclick = async () => {
  // connectionState not supported in firefox
  mostrarCargando();
  if (peerConnection?.signalingState === 'stable' || peerConnection?.iceConnectionState === 'connected') {
    const mensaje_chat = document.getElementById('mensajechat').value;
    addMessageToChat(mensaje_chat, true);

    const watsonResponse = await fetch(`${ENV_WATSON.ASSISTANT_URL}/v2/assistants/${ENV_WATSON.ASSISTANT_ID}/sessions/${watsonSessionId}/message?version=2021-11-27`, 
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + btoa(`apikey:${ENV_WATSON.ASSISTANT_KEY}`)
        },
        // body: '{"input": {"text": "Hello"}}',
        body: JSON.stringify({
          'input': {
            'text': mensaje_chat
          }
        })
      }
    );

    const { output: outputWatson } = await watsonResponse.json()
    console.log(outputWatson);

    if (outputWatson.intents.length === 0 ) {
      console.log("No hay intents");
      const blank_msg = await fetch(`${ENV_WATSON.ASSISTANT_URL}/v2/assistants/${ENV_WATSON.ASSISTANT_ID}/sessions/${watsonSessionId}/message?version=2021-11-27`, 
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + btoa(`apikey:${ENV_WATSON.ASSISTANT_KEY}`)
        },
        // body: '{"input": {"text": "Hello"}}',
        body: JSON.stringify({
          'input': {
            'text': " "
          }
        })
      });

      const { output: outputWatson } = await blank_msg.json()
      console.log(outputWatson);
      watsonResponseChat = concatenateTexts(outputWatson.generic);
    } 
    else {
      watsonResponseChat = concatenateTexts(outputWatson.generic);
    }

    /*const { output: outputWatson } = await blank_msg.json()
    console.log(outputWatson);
    watsonResponseChat = concatenateTexts(outputWatson.generic);
    console.log(watsonResponseChat); */
    borrarTexto();
    addMessageToChat(watsonResponseChat.replace(/<br \/>/g, ''), false);

    const talkResponse = await fetch(`${DID_API.url}/talks/streams/${streamId}`,
      {
        method: 'POST',
        headers: { Authorization: `Basic ${DID_API.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          'script': {
            'type': 'text',
            'provider': {
              'type': 'microsoft',
              'voice_id': 'es-AR-TomasNeural'
            },
            'ssml': 'false',
            'input': formatearCadena(watsonResponseChat)
          },
          'config': {
            'stitch': true,
          },
          'session_id': sessionId
        })
      })

    ocultarCargando();
  }
};

function onIceGatheringStateChange() {
  iceGatheringStatusLabel.innerText = peerConnection.iceGatheringState;
  iceGatheringStatusLabel.className = 'iceGatheringState-' + peerConnection.iceGatheringState;
}
function onIceCandidate(event) {
  console.log('onIceCandidate', event);
  if (event.candidate) {
    const { candidate, sdpMid, sdpMLineIndex } = event.candidate;
    
    fetch(`${DID_API.url}/talks/streams/${streamId}/ice`,
      {
        method: 'POST',
        headers: {Authorization: `Basic ${DID_API.key}`, 'Content-Type': 'application/json'},
        body: JSON.stringify({ candidate, sdpMid, sdpMLineIndex, session_id: sessionId})
      }); 
  }
}
function onIceConnectionStateChange() {
  iceStatusLabel.innerText = peerConnection.iceConnectionState;
  iceStatusLabel.className = 'iceConnectionState-' + peerConnection.iceConnectionState;
  if (peerConnection.iceConnectionState === 'failed' || peerConnection.iceConnectionState === 'closed') {
    stopAllStreams();
    closePC();
  }
}
function onConnectionStateChange() {
  // not supported in firefox
  peerStatusLabel.innerText = peerConnection.connectionState;
  peerStatusLabel.className = 'peerConnectionState-' + peerConnection.connectionState;
}
function onSignalingStateChange() {
  signalingStatusLabel.innerText = peerConnection.signalingState;
  signalingStatusLabel.className = 'signalingState-' + peerConnection.signalingState;
}
function onTrack(event) {
  const remoteStream = event.streams[0];
  setVideoElement(remoteStream);
}

async function createPeerConnection(offer, iceServers) {
  if (!peerConnection) {
    peerConnection = new RTCPeerConnection({iceServers});
    peerConnection.addEventListener('icegatheringstatechange', onIceGatheringStateChange, true);
    peerConnection.addEventListener('icecandidate', onIceCandidate, true);
    peerConnection.addEventListener('iceconnectionstatechange', onIceConnectionStateChange, true);
    peerConnection.addEventListener('connectionstatechange', onConnectionStateChange, true);
    peerConnection.addEventListener('signalingstatechange', onSignalingStateChange, true);
    peerConnection.addEventListener('track', onTrack, true);
  }

  await peerConnection.setRemoteDescription(offer);
  console.log('set remote sdp OK');

  const sessionClientAnswer = await peerConnection.createAnswer();
  console.log('create local sdp OK');

  await peerConnection.setLocalDescription(sessionClientAnswer);
  console.log('set local sdp OK');

  return sessionClientAnswer;
}

function setVideoElement(stream) {
  if (!stream) return;
  talkVideo.srcObject = stream;

  // safari hotfix
  if (talkVideo.paused) {
    talkVideo.play().then(_ => {}).catch(e => {});
  }
}

function stopAllStreams() {
  if (talkVideo.srcObject) {
    console.log('stopping video streams');
    talkVideo.srcObject.getTracks().forEach(track => track.stop());
    talkVideo.srcObject = null;
  }
}

function closePC(pc = peerConnection) {
  if (!pc) return;
  console.log('stopping peer connection');
  pc.close();
  pc.removeEventListener('icegatheringstatechange', onIceGatheringStateChange, true);
  pc.removeEventListener('icecandidate', onIceCandidate, true);
  pc.removeEventListener('iceconnectionstatechange', onIceConnectionStateChange, true);
  pc.removeEventListener('connectionstatechange', onConnectionStateChange, true);
  pc.removeEventListener('signalingstatechange', onSignalingStateChange, true);
  pc.removeEventListener('track', onTrack, true);
  iceGatheringStatusLabel.innerText = '';
  signalingStatusLabel.innerText = '';
  iceStatusLabel.innerText = '';
  peerStatusLabel.innerText = '';
  console.log('stopped peer connection');
  if (pc === peerConnection) {
    peerConnection = null;
  }
}

const customizeButton = document.getElementById('customize-button');
const modalContainer = document.getElementById('modal-container');
const takePictureButton = document.getElementById('take-picture');
const cancelButton = document.getElementById('cancel-button');
const camera = document.getElementById('camera');
const downloadLink = document.getElementById('downloadLink');

// Función para mostrar el modal
function openModal() {
    modalContainer.style.display = 'flex';
    startCamera();
}

// Función para cerrar el modal
function closeModal() {
    modalContainer.style.display = 'none';
    stopCamera();
}

// Función para iniciar la cámara
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        camera.srcObject = stream;
    } catch (error) {
        console.error('Error al acceder a la cámara:', error);
    }
}

// Función para detener la cámara
function stopCamera() {
    const stream = camera.srcObject;
    const tracks = stream.getTracks();

    tracks.forEach((track) => {
        track.stop();
    });

    camera.srcObject = null;
}

// Asociar la función openModal al evento click del botón Personaliza
customizeButton.addEventListener('click', openModal);

// Asociar la función closeModal al evento click del botón Cancelar
cancelButton.addEventListener('click', closeModal);

// Asociar la función para tomar una foto al evento click del botón Tomar Foto
takePictureButton.addEventListener('click', () => {
    // Aquí puedes implementar la lógica para tomar una foto y enviarla a una API
    captureImage();
});

// Function to capture an image from the camera
async function captureImage() {
  const canvas = document.createElement('canvas');
  canvas.width = camera.videoWidth;
  console.log(camera.videoWidth);
  canvas.height = camera.videoHeight;
  console.log(camera.videoHeight);
  canvas.getContext('2d').drawImage(camera, 0, 0, canvas.width, canvas.height);
  const imageDataBlob = await new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/png');
  });

  // Send the captured image (Blob) to an API
  sendImageToAPI(imageDataBlob);

  // Display the download link and set the captured image as the href
  downloadLink.href = URL.createObjectURL(imageDataBlob);
  downloadLink.style.display = 'block';
}

// Function to send the image to an API
async function sendImageToAPI(imageDataBlob) {
  try {
    const formData = new FormData();
    formData.append('image', imageDataBlob);

    const response = await fetch(`${DID_API.url}/images`, {
      method: 'POST',
      body: formData,
      headers: {
        accept: 'application/json',
        'content-type': 'multipart/form-data', 
        Authorization: `Basic ${DID_API.key}`}
    });

    if (response.ok) {
      console.log('Image sent to the API successfully');
      console.log(response);
    } else {
      console.error('Failed to send image to the API');
    }
  } catch (error) {
    console.error('Error sending image to the API:', error);
  }
}