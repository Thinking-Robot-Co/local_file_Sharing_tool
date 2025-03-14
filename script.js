document.addEventListener("DOMContentLoaded", () => {
    // DOM elements
    const peerIdDisplay = document.getElementById("peer-id");
    const connectBtn = document.getElementById("connect-btn");
    const connectIdInput = document.getElementById("connect-id");
    const sendBtn = document.getElementById("send-btn");
    const fileInput = document.getElementById("file-input");
    const progressBar = document.getElementById("transfer-progress");
    const statusMsg = document.getElementById("status-message");
  
    // Use the default PeerJS configuration
    // (This will automatically use the default cloud server, which is configured for HTTPS.)
    const peer = new Peer();
  
    // Error handling for PeerJS
    peer.on('error', err => {
      console.error("Peer error:", err);
      peerIdDisplay.innerText = "Error: " + err;
      statusMsg.innerText = "Peer error: " + err;
    });
  
    let conn = null; // Will hold the connection between peers
    let receivedFileMeta = null;
    let receivedBuffers = [];
    let receivedSize = 0;
  
    // When the peer connection is open, display the assigned Peer ID
    peer.on('open', id => {
      peerIdDisplay.innerText = id;
      console.log("My Peer ID:", id);
    });
  
    // Handle incoming connection requests from other peers
    peer.on('connection', connection => {
      conn = connection;
      setupConnection(conn);
    });
  
    // Connect to a peer when the "Connect" button is clicked
    connectBtn.addEventListener("click", () => {
      const targetId = connectIdInput.value.trim();
      if (!targetId) {
        alert("Please enter a valid Peer ID.");
        return;
      }
      conn = peer.connect(targetId);
      setupConnection(conn);
    });
  
    // Set up event listeners for the connection
    function setupConnection(connection) {
      connection.on('open', () => {
        console.log("Connected to peer:", connection.peer);
        statusMsg.innerText = "Connected to " + connection.peer;
      });
      connection.on('data', handleData);
      connection.on('error', err => {
        console.error("Connection error:", err);
        statusMsg.innerText = "Connection error: " + err;
      });
    }
  
    // Send file when the "Send File" button is clicked
    sendBtn.addEventListener("click", () => {
      if (!conn || !conn.open) {
        alert("No connection established. Please connect to a peer first.");
        return;
      }
      const file = fileInput.files[0];
      if (!file) {
        alert("Please select a file to send.");
        return;
      }
      sendFile(file);
    });
  
    // Function to send a file in 16KB chunks
    function sendFile(file) {
      const chunkSize = 16 * 1024; // 16 KB per chunk
      const totalChunks = Math.ceil(file.size / chunkSize);
      let currentChunk = 0;
  
      // Send file metadata first
      const fileMeta = { fileName: file.name, fileSize: file.size, totalChunks: totalChunks };
      conn.send(JSON.stringify({ type: 'file-meta', data: fileMeta }));
  
      const reader = new FileReader();
  
      reader.onload = (e) => {
        const chunkData = e.target.result;
        conn.send(chunkData);
        currentChunk++;
        const progressPercent = Math.floor((currentChunk / totalChunks) * 100);
        progressBar.value = progressPercent;
        statusMsg.innerText = `Sending file: ${progressPercent}%`;
  
        if (currentChunk < totalChunks) {
          readNextChunk();
        } else {
          statusMsg.innerText = "File transfer complete!";
        }
      };
  
      reader.onerror = (err) => {
        console.error("Error reading file:", err);
        statusMsg.innerText = "Error reading file.";
      };
  
      function readNextChunk() {
        const start = currentChunk * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const blob = file.slice(start, end);
        reader.readAsArrayBuffer(blob);
      }
  
      // Start sending file chunks
      readNextChunk();
    }
  
    // Handle incoming data (both metadata and file chunks)
    function handleData(data) {
      // If data is a string, it should be file metadata
      if (typeof data === 'string') {
        try {
          const msg = JSON.parse(data);
          if (msg.type === 'file-meta') {
            receivedFileMeta = msg.data;
            receivedBuffers = [];
            receivedSize = 0;
            statusMsg.innerText = `Receiving file: ${receivedFileMeta.fileName}`;
            progressBar.value = 0;
            console.log("Receiving file metadata:", receivedFileMeta);
          }
        } catch (err) {
          console.error("Error parsing received data:", err);
        }
      } else if (data instanceof ArrayBuffer) {
        // Accumulate file chunks
        receivedBuffers.push(data);
        receivedSize += data.byteLength;
        if (receivedFileMeta) {
          const progressPercent = Math.floor((receivedSize / receivedFileMeta.fileSize) * 100);
          progressBar.value = progressPercent;
          statusMsg.innerText = `Receiving file: ${progressPercent}%`;
  
          // When file fully received, reconstruct it and provide a download link
          if (receivedSize >= receivedFileMeta.fileSize) {
            const blob = new Blob(receivedBuffers);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = receivedFileMeta.fileName;
            a.textContent = `Download ${receivedFileMeta.fileName}`;
            statusMsg.innerHTML = "";
            statusMsg.appendChild(a);
            // Reset receiving variables
            receivedFileMeta = null;
            receivedBuffers = [];
            receivedSize = 0;
            progressBar.value = 100;
          }
        }
      }
    }
  });
  