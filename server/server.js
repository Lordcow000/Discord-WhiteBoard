import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { createServer } from "http"; 
import { Server } from "socket.io"; 
import { time } from "console";

dotenv.config({ path: "../.env" });

const app = express();
const port = process.env.PORT || 3001;

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: [
      "https://discord-white-board-git-getting-it-to-work-lordcow.vercel.app", 
      "https://*.discordsays.com"
    ],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['polling', 'websocket'] 
});




// Allow express to parse JSON bodies
app.use(express.json());

const roomHistories = {};

io.on("connection", (socket) => {
  console.log('MEOWOWNEOWNEOWNEOWMEOWMEO');
  
  socket.on("join-channel", (channelId) => {

    socket.join(channelId);
    socket.currentRoom = channelId;

    if (!roomHistories[channelId]) {
      roomHistories[channelId] = [];
      console.log(`New canvas created for room: ${channelId}`);
    };
    

    console.log(`User joined Discord channel room: ${channelId}. At: ${new Date(Date.now()).toUTCString()}`);
    socket.emit('canvas-history', roomHistories[channelId]);


    socket.on('disconnect', (reason) => {
      console.log(`User left: ${reason}`)
      if ((io.sockets.adapter.rooms.get(channelId)?.size || 0) === 0){
        console.log('No users left in room. Deleting room log');
        delete roomHistories[channelId];
      }
    })


  });


  socket.on("input-change", (data) => {
    if (socket.currentRoom) {
      socket.broadcast.emit("update-input", data);
    }
  });



  socket.on('draw-line', (data) => {
    if (socket.currentRoom) {
      socket.to(data.channelId).emit("update-line", data.line);
      
      roomHistories[data.channelId].push(data.line);

      //socket.broadcast.emit("update-line", data.line);
    }
  });


  socket.on('meow', () => {
    console.log('meow')
  }) 

});


app.post("/api/token", async (req, res) => {
  
  // Exchange the code for an access_token
  const response = await fetch(`https://discord.com/api/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: process.env.VITE_DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code: req.body.code,
    }),
  });

  // Retrieve the access_token from the response
  const { access_token } = await response.json();

  // Return the access_token to our client as { access_token: "..."}
  res.send({access_token});
});

httpServer.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
