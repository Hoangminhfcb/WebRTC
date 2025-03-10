'use strict';

// Các biến WebRTC
let localStream;
let remoteStream;
let peerConnection;
let signalConnection;
let remoteClientId;

// Các biến DOM
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startButton = document.getElementById('startButton');
const callButton = document.getElementById('callButton');
const hangupButton = document.getElementById('hangupButton');
const statusMessage = document.getElementById('statusMessage');

// Cấu hình ICE servers
const servers = {
    iceServers: [
        { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
        {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        }
    ]
};

// Xử lý sự kiện click
startButton.addEventListener('click', startMedia);
callButton.addEventListener('click', startCall);
hangupButton.addEventListener('click', hangup);

// Khởi tạo kết nối signaling
function connectSignaling() {
    // Lấy địa chỉ máy chủ từ URL hiện tại
    const protocol = location.protocol === 'https:' ? 'https' : 'http';
    const host = location.hostname;
    const port = location.port;

    statusMessage.textContent = 'Đang kết nối với máy chủ...';

    // Tạo kết nối SignalR
    signalConnection = new signalR.HubConnectionBuilder()
        .withUrl(`https://signalr-0bv0.onrender.com/signalhub`)
        .withAutomaticReconnect()
        .build();

    // Xử lý các sự kiện signaling
    signalConnection.on('ReceiveOffer', handleOffer);
    signalConnection.on('ReceiveAnswer', handleAnswer);
    signalConnection.on('ReceiveIceCandidate', handleIceCandidate);

    // Bắt đầu kết nối
    signalConnection.start()
        .then(() => {
            statusMessage.textContent = 'Đã kết nối với máy chủ signaling';
        })
        .catch(error => {
            statusMessage.textContent = `Lỗi kết nối: ${error.message}`;
            console.error('Lỗi kết nối SignalR:', error);
        });
}

// Bắt đầu stream media
async function startMedia() {
    try {
        startButton.disabled = true;
        statusMessage.textContent = 'Đang kiểm tra khả năng truy cập camera...';

        // Polyfill cho các trình duyệt cũ
        if (navigator.mediaDevices === undefined) {
            navigator.mediaDevices = {};
        }

        // Polyfill cho getUserMedia
        if (navigator.mediaDevices.getUserMedia === undefined) {
            navigator.mediaDevices.getUserMedia = function (constraints) {
                const getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

                if (!getUserMedia) {
                    statusMessage.textContent = 'Trình duyệt này không hỗ trợ getUserMedia!';
                    return Promise.reject(new Error('getUserMedia không được hỗ trợ'));
                }

                return new Promise(function (resolve, reject) {
                    getUserMedia.call(navigator, constraints, resolve, reject);
                });
            };
        }

        // Tiếp tục với getUserMedia như bình thường
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: {
                facingMode: 'user',
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        });

        localVideo.srcObject = localStream;
        connectSignaling();
        callButton.disabled = false;
        statusMessage.textContent = 'Sẵn sàng để gọi';
    } catch (error) {
        statusMessage.textContent = `Lỗi truy cập media: ${error.message}`;
        console.error('Không thể truy cập media:', error);
        startButton.disabled = false;
    }
}

// Tạo peer connection
function createPeerConnection() {
    peerConnection = new RTCPeerConnection(servers);

    // Thêm local stream
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    // Xử lý khi nhận được remote stream
    peerConnection.ontrack = event => {
        remoteStream = event.streams[0];
        remoteVideo.srcObject = remoteStream;
    };

    // Xử lý ice candidates
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            sendIceCandidate(event.candidate);
        }
    };

    // Xử lý thay đổi trạng thái kết nối
    peerConnection.oniceconnectionstatechange = () => {
        statusMessage.textContent = `Trạng thái ICE: ${peerConnection.iceConnectionState}`;
        if (peerConnection.iceConnectionState === 'connected' ||
            peerConnection.iceConnectionState === 'completed') {
            hangupButton.disabled = false;
            callButton.disabled = true;
            statusMessage.textContent = 'Đã kết nối';
        } else if (peerConnection.iceConnectionState === 'disconnected' ||
            peerConnection.iceConnectionState === 'failed') {
            statusMessage.textContent = 'Kết nối bị ngắt';
        }
    };
}

// Bắt đầu cuộc gọi
async function startCall() {
    callButton.disabled = true;
    statusMessage.textContent = 'Đang tạo kết nối...';

    createPeerConnection();

    try {
        // Tạo offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        // Gửi offer qua server signaling
        await signalConnection.invoke('SendOffer', JSON.stringify(offer));
        statusMessage.textContent = 'Đã gửi offer, đang chờ phản hồi...';
    } catch (error) {
        statusMessage.textContent = `Lỗi khi tạo cuộc gọi: ${error.message}`;
        console.error('Lỗi khi tạo offer:', error);
        callButton.disabled = false;
    }
}

// Xử lý offer nhận được
async function handleOffer(offerJson, connectionId) {
    if (!peerConnection) {
        createPeerConnection();
    }

    remoteClientId = connectionId;
    statusMessage.textContent = 'Đã nhận offer, đang xử lý...';

    try {
        const offer = JSON.parse(offerJson);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

        // Tạo answer
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        // Gửi answer
        await signalConnection.invoke('SendAnswer', JSON.stringify(answer), connectionId);
        statusMessage.textContent = 'Đã gửi answer, đang thiết lập kết nối...';
    } catch (error) {
        statusMessage.textContent = `Lỗi khi xử lý offer: ${error.message}`;
        console.error('Lỗi khi xử lý offer:', error);
    }
}

// Xử lý answer nhận được
async function handleAnswer(answerJson, connectionId) {
    remoteClientId = connectionId;
    statusMessage.textContent = 'Đã nhận answer, đang thiết lập kết nối...';

    try {
        const answer = JSON.parse(answerJson);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
        statusMessage.textContent = `Lỗi khi xử lý answer: ${error.message}`;
        console.error('Lỗi khi xử lý answer:', error);
    }
}

// Xử lý ICE candidate nhận được
async function handleIceCandidate(candidateJson, connectionId) {
    try {
        const candidate = JSON.parse(candidateJson);
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
        console.error('Lỗi khi xử lý ice candidate:', error);
    }
}

// Gửi ICE candidate
async function sendIceCandidate(candidate) {
    if (signalConnection && signalConnection.state === signalR.HubConnectionState.Connected) {
        try {
            await signalConnection.invoke('SendIceCandidate', JSON.stringify(candidate), remoteClientId);
        } catch (error) {
            console.error('Lỗi khi gửi ice candidate:', error);
        }
    }
}

// Kết thúc cuộc gọi
function hangup() {
    statusMessage.textContent = 'Kết thúc cuộc gọi';

    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    remoteVideo.srcObject = null;
    hangupButton.disabled = true;
    callButton.disabled = false;
}