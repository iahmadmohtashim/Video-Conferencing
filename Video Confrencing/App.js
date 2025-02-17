import React, { useRef, useEffect, useState } from 'react';
import io from 'socket.io-client';

const App = () => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pc = useRef(new RTCPeerConnection());
  const socket = useRef(io('ws://localhost:8080/ws'));

  useEffect(() => {
    const startLocalStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        localVideoRef.current.srcObject = stream;
        stream.getTracks().forEach(track => pc.current.addTrack(track, stream));
      } catch (error) {
        console.error('Error accessing media devices.', error);
      }
    };

    const handleSocketMessages = () => {
      socket.current.on('message', async message => {
        const data = JSON.parse(message);

        switch (data.type) {
          case 'offer':
            await pc.current.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await pc.current.createAnswer();
            await pc.current.setLocalDescription(new RTCSessionDescription(answer));
            socket.current.emit('message', JSON.stringify({ type: 'answer', answer }));
            break;
          case 'answer':
            await pc.current.setRemoteDescription(new RTCSessionDescription(data.answer));
            break;
          case 'candidate':
            await pc.current.addIceCandidate(new RTCIceCandidate(data.candidate));
            break;
          default:
            break;
        }
      });
    };

    const handlePeerConnection = () => {
      pc.current.onicecandidate = event => {
        if (event.candidate) {
          socket.current.emit('message', JSON.stringify({ type: 'candidate', candidate: event.candidate }));
        }
      };

      pc.current.ontrack = event => {
        const [stream] = event.streams;
        setRemoteStream(stream);
        remoteVideoRef.current.srcObject = stream;
      };
    };

    startLocalStream();
    handleSocketMessages();
    handlePeerConnection();
  }, []);

  const createOffer = async () => {
    const offer = await pc.current.createOffer();
    await pc.current.setLocalDescription(new RTCSessionDescription(offer));
    socket.current.emit('message', JSON.stringify({ type: 'offer', offer }));
  };

  return (
    <div>
      <h1>Video Conferencing</h1>
      <div>
        <video ref={localVideoRef} autoPlay playsInline muted />
        <video ref={remoteVideoRef} autoPlay playsInline />
      </div>
      <button onClick={createOffer}>Start Call</button>
    </div>
  );
};

export default App;