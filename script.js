let APP_ID = "b44d16b2eb41419ba0084072fcb75c90";

let token = null;

let uid = String(Math.floor(Math.random() * 10000));


let client;
let channel;

let localStream;
let remoteStream;
let peerConnection;

const servers = {
    iceServers: [
        {
            urls:['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
        }
    ]
}


let init = async () => {
    client = await AgoraRTM.createInstance(APP_ID)
    await client.login({uid, token})

    channel = client.createChannel('main')

    await channel.join()

    channel.on('MemberJoined', handleUserJoined)

    client.on('MessageFromPeer', handleMessageFromPeer)
    
    localStream = await navigator.mediaDevices.getUserMedia({video:true, audio:true});
    document.getElementById('user-1').srcObject = localStream;

}

let handleMessageFromPeer = async (message, MemberId) => {
    message = JSON.parse(message.text);

    if (message.type === 'offer') {
        if (!peerConnection) {
            await createPeerConnection(MemberId);
        }

        try {
            await peerConnection.setRemoteDescription(message.offer);
            createAnswer(MemberId);
        } catch (error) {
            console.error("Error setting remote description:", error);
        }
    } else if (message.type === 'answer') {
        addAnswer(message.answer);
    } else if (message.type === 'candidate') {
        if (peerConnection && peerConnection.remoteDescription) {
            try {
                await peerConnection.addIceCandidate(message.candidate);
            } catch (error) {
                console.error('Error adding ice candidate:', error);
            }
        }
    }
};



let handleUserJoined = async (MemberId) => {
    console.log('A new user is joined the channel:', MemberId);
    createOffer(MemberId)

}

let createPeerConnection = async(MemberId) => {
    peerConnection = new RTCPeerConnection(servers);

    remoteStream = new MediaStream();
    document.getElementById('user-2').srcObject = remoteStream;

    if (!localStream) {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById('user-1').srcObject = localStream;
    }

    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
            client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'candidate', 'candidate': event.candidate }) }, MemberId);
        }
    };

    peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track);
        });
    };
    
    
}

let createOffer = async (MemberId) => {
   
    await createPeerConnection(MemberId)


    let offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    client.sendMessageToPeer({text:JSON.stringify({'type':'offer', 'offer':offer})}, MemberId)
}

let createAnswer = async (MemberId) => {
    if (!peerConnection) {
        console.error("Peer connection does not exist.");
        return;
    }

    try {
        let answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'answer', 'answer': answer }) }, MemberId);
    } catch (error) {
        console.error("Error creating answer:", error);
    }
};



let addAnswer = async (answer) => {
    if (peerConnection && !peerConnection.currentRemoteDescription) {
        await peerConnection.setRemoteDescription(answer);
    }
};


let leaveChannel = async () => {
    await channel.leave()
    await client.logout()
}

window.addEventListener('beforeunload', leaveChannel)

init()