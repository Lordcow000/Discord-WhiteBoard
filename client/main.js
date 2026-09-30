import { DiscordSDK } from "@discord/embedded-app-sdk";
import { io } from "socket.io-client";
import rocketLogo from '/rocket.png';
import "./style.css";

const socket = io('https://lordcow-whiteboard.onrender.com'); 

// Will eventually store the authenticated user's access_token
let auth;

const discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);

setupInputSync(discordSdk.channelId); 

setupDiscordSdk().then(() => {
  console.log("Discord SDK is authenticated");

  //appendVoiceChannelName();
  //appendGuildAvatar();

  setupInputSync(discordSdk.channelId);

  // We can now make API calls within the scopes we requested in setupDiscordSDK()
  // Note: the access_token returned is a sensitive secret and should be treated as such
});

async function setupDiscordSdk() {
  await discordSdk.ready();
  console.log("Discord SDK is ready");

  // Authorize with Discord Client
  const { code } = await discordSdk.commands.authorize({
    client_id: import.meta.env.VITE_DISCORD_CLIENT_ID,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: [
      "identify",
      "guilds",
      "applications.commands"
    ],
  });

  // Retrieve an access_token from your activity's server
  const response = await fetch("https://lordcow-whiteboard.onrender.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
    }),
  });
  const { access_token } = await response.json();

  // Authenticate with Discord client (using the access_token)
  auth = await discordSdk.commands.authenticate({
    access_token,
  });

  if (auth == null) {
    throw new Error("Authenticate command failed");
  }
}

document.querySelector('#app').innerHTML = `
  <div>
    <img src="${rocketLogo}" class="logo" alt="Discord" />
    <h1>Hello, World!</h1>
    <input type="text" id="username" name="username" placeholder="Type to sync...">
    <br>
    <div class="controls">
      <button id="btn-paint">Paint</button>
      <button id="btn-erase">Eraser</button>
    </div>

    <canvas id="canvas" name="canvas" height="600" width="800"></canvas>
  </div>
`;

async function appendVoiceChannelName() {
  const app = document.querySelector('#app');

  let activityChannelName = 'Unknown';

  // Requesting the channel in GDMs (when the guild ID is null) requires
  // the dm_channels.read scope which requires Discord approval.
  if (discordSdk.channelId != null && discordSdk.guildId != null) {
    // Over RPC collect info about the channel
    const channel = await discordSdk.commands.getChannel({channel_id: discordSdk.channelId});
    if (channel.name != null) {
      activityChannelName = channel.name;
    }
  }

  // Update the UI with the name of the current voice channel
  const textTagString = `Activity Channel: "${activityChannelName}"`;
  const textTag = document.createElement('p');
  textTag.textContent = textTagString;
  app.appendChild(textTag);
}

async function appendGuildAvatar() {
  const app = document.querySelector('#app');

  // 1. From the HTTP API fetch a list of all of the user's guilds
  const guilds = await fetch(`https://discord.com/api/v10/users/@me/guilds`, {
    headers: {
      // NOTE: we're using the access_token provided by the "authenticate" command
      Authorization: `Bearer ${auth.access_token}`,
      'Content-Type': 'application/json',
    },
  }).then((response) => response.json());

  // 2. Find the current guild's info, including it's "icon"
  const currentGuild = guilds.find((g) => g.id === discordSdk.guildId);

  // 3. Append to the UI an img tag with the related information
  if (currentGuild != null) {
    const guildImg = document.createElement('img');
    guildImg.setAttribute(
      'src',
      // More info on image formatting here: https://docs.discord.com/developers/reference#image-formatting
      `https://cdn.discordapp.com/icons/${currentGuild.id}/${currentGuild.icon}.webp?size=128`
    );
    guildImg.setAttribute('width', '128px');
    guildImg.setAttribute('height', '128px');
    guildImg.setAttribute('style', 'border-radius: 50%;');
    app.appendChild(guildImg);
  } else {
    app.appendChild(document.createElement('img').setAttribute('src', rocketLogo))
  }
}

function setupInputSync(channelId) {
  const inputEl = document.querySelector('#username');

  if (!inputEl) return;
  
  if (channelId) {
    socket.emit('join-channel', channelId);
  }

  // Emit changes to the server as the user types
  inputEl.addEventListener('input', () => {
    socket.emit('input-change', inputEl.value);
  });

  // Receive changes from other clients in the Discord voice channel
  socket.on('update-input', (newValue) => {
    inputEl.value = newValue;
  });
};

let goodToDraw = false;

socket.on('canvas-history', (history) => {
  history.forEach(line => {
      drawLineSegment(line.p0, line.p1, line.color, line.width, line.mode);
  });
  goodToDraw = true;
});

//region CANVAS SHI

// Brush colour and size
const colour = "#3d34a5";
const strokeWidth = 25;

// Drawing state
let latestPoint;
let drawing = false;
let isEraser = false;

// Set up our drawing context
const canvas = document.getElementById("canvas");
const context = canvas.getContext("2d");

document.getElementById('btn-erase').addEventListener('click', () => {
  isEraser = true;
});

document.getElementById('btn-paint').addEventListener('click', () => {
  isEraser = false;
});


context.globalCompositeOperation = 'source-over'

const channelId = discordSdk.channelId

const drawLineSegment = (p0, p1, strokeColor, width, mode = 'paint') => {
  context.save()

  if (mode === 'erase') {
    context.globalCompositeOperation = 'destination-out'
  } else {
    context.globalCompositeOperation = 'source-over';
  }

  context.beginPath();
  context.moveTo(p0[0], p0[1]);
  context.strokeStyle = strokeColor;
  context.lineWidth = width;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineTo(p1[0], p1[1]);
  context.stroke();

  context.restore()
};


// Drawing functions

const continueStroke = newPoint => {
  if(!goodToDraw) return;

  const currentMode = isEraser ? 'erase' : 'paint';

  drawLineSegment(latestPoint, newPoint, colour, strokeWidth, currentMode)
  
  socket.emit('draw-line', {
    channelId,
    line: { 
        p0: latestPoint, 
        p1: newPoint, 
        color: colour, 
        width: strokeWidth,
        mode: currentMode
    }
  });

  latestPoint = newPoint;
};

socket.on('update-line', (data) => {
  drawLineSegment(data.p0, data.p1, data.color, data.width, data.mode);
});

// Event helpers

const startStroke = point => {
    drawing = true;
    latestPoint = point;
};

const BUTTON = 0b01;
const mouseButtonIsDown = buttons => (BUTTON & buttons) === BUTTON;

// Event handlers

const mouseMove = evt => {
    if (!drawing) {
        return;
    }
    continueStroke([evt.offsetX, evt.offsetY]);
};

const mouseDown = evt => {
    if (drawing) {
        return;
    }
    evt.preventDefault();
    canvas.addEventListener("mousemove", mouseMove, false);
    startStroke([evt.offsetX, evt.offsetY]);
};

const mouseEnter = evt => {
    if (!mouseButtonIsDown(evt.buttons) || drawing) {
        return;
    }
    mouseDown(evt);
};

const endStroke = evt => {
    if (!drawing) {
        return;
    }
    drawing = false;
    evt.currentTarget.removeEventListener("mousemove", mouseMove, false);
};

const getTouchPoint = evt => {
    if (!evt.currentTarget) {
        return [0, 0];
    }
    const rect = evt.currentTarget.getBoundingClientRect();
    const touch = evt.targetTouches[0];
    return [touch.clientX - rect.left, touch.clientY - rect.top];
};

const touchStart = evt => {
    if (drawing) {
        return;
    }
    evt.preventDefault();
    startStroke(getTouchPoint(evt));
};

const touchMove = evt => {
    if (!drawing) {
        return;
    }
    continueStroke(getTouchPoint(evt));
};

const touchEnd = evt => {
    drawing = false;
};

canvas.addEventListener("touchstart", touchStart, false);
canvas.addEventListener("touchend", touchEnd, false);
canvas.addEventListener("touchcancel", touchEnd, false);
canvas.addEventListener("touchmove", touchMove, false);

canvas.addEventListener("mousedown", mouseDown, false);
canvas.addEventListener("mouseup", endStroke, false);
canvas.addEventListener("mouseout", endStroke, false);
canvas.addEventListener("mouseenter", mouseEnter, false);


