/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow
 */

import React, {Component} from 'react';
import {Platform, StyleSheet, Text, View, TouchableOpacity, ScrollView, TextInput} from 'react-native';

import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  MediaStream,
  MediaStreamTrack,
  mediaDevices
  // getUserMedia
} from 'react-native-webrtc';

const instructions = Platform.select({
  ios: 'Press Cmd+R to reload,\n' + 'Cmd+D or shake for dev menu',
  android:
    'Double tap R on your keyboard to reload,\n' +
    'Shake or press menu button for dev menu',
});

const servers = {
    iceServers: [
//        {urls: 'stun:stun.l.google.com:19302'},
//        {urls: stunServers},
        {
            urls: 'turn:52.88.28.2:3478',
            username: 'turnuser',
            credential: 'turn.pass'
        }
    ]
};

type Props = {};
export default class App extends Component<Props> {

  constructor() {
    super();
    this.state = {
        open: false,
        info: 'Initializing',
        status: 'init',
        roomID: '',
        isFront: true,
        selfViewSrc: null,
        remoteList: {},
        textRoomConnected: false,
        textRoomData: [],
        textRoomValue: '',
        connected: false,
        ice_connection_state: '',
        pendingCandidates: [],
        remoteStreamURL:null,
        localStreamURL:null,
        desc:'aaaaaaaaaaaaaaaaaaaa'
    };
  }
    componentWillMount(){
      console.warn("will mount")
    }
    componentDidMount(){
      console.warn("did Mount");
      this.wsChat = new WebSocket('wss://scholars-home.org/chatsocket');
      this.room = '12345';
      this.myPC = null;
      this.pcPeers = {};
      this.streamConstraints = null;
      this.myMediaStream = null;
      // console.warn(JSON.stringify(this.wsChat))
      this.wsChat.addEventListener('open', (event) => {
          console.warn('open event listener');
      });
      //
      this.wsChat.addEventListener('message', (event) => {
          console.warn('Message event listener');
      });
      console.warn(JSON.stringify(this.wsChat.readyState))
      //
      // if(this.wsChat.readyState !=0 ){
      //     // location.reload();
      // }
      //
      // console.log(wsChat);
      //
      this.wsChat.onopen = (event) => {
          console.warn('connected');
          //subscribe to room
          this.wsChat.send(JSON.stringify({
              action: 'subscribe',
              room: this.room
          }));
          // showSnackBar("Connected to the chat server!", 5000);
          this.streamConstraints = {video:{facingMode:'user'}, audio:true};
          console.warn(JSON.stringify(this.streamConstraints));

      };
      this.wsChat.onerror = (event) => {
          console.warn("Unable to connect to the chat server! Kindly refresh");
      };
      this.wsChat.onmessage = (e) => {
          console.warn('Detailed event: '+e.data);
          let data = JSON.parse(e.data);
          if(data.room === this.room){
            switch(data.action){
              case 'callRejected':
                    console.warn('callRejected -> Your call is rejected by remote');
                    //get response to call initiation (if user is the initiator)
                    //show received message (i.e. reason for rejection) and end call
                    break;

                case 'endCall':
                    // document.getElementById("calleeInfo").style.color = 'red';
                    // document.getElementById("calleeInfo").innerHTML = data.msg;
                    // setTimeout(function(){
                    //     document.getElementById("rcivModal").style.display = 'none';
                    // }, 3000);
                    // document.getElementById('callerTone').pause();
                    break;

                case 'startCall':
                    console.warn("startCall called");
//                    console.log('startCall -> Remote is telling he is ok to proceed with your call');
                    this.startCall(false);//to start call when callee gives the go ahead (i.e. answers call)
                    break;

                case 'candidate':
                    console.warn('candidate -> Remote is sending his candidate information');
                    //message is iceCandidate
                    this.myPC ? this.myPC.addIceCandidate(new RTCIceCandidate(data.candidate)) : "";

                    break;

                case 'sdp':
                    console.warn('sdp -> Remote is sending his SDP');
//                    var formattedSdp = data.sdp.sdp;
                    data.sdp.sdp = data.sdp.sdp.toString().replace(/#/g, '');
                    console.warn(data.sdp.sdp);
                    // console.warn(data.sdp.sdp);
                    // alert(data.sdp.sdp);
                    this.myPC ? this.myPC.setRemoteDescription(new RTCSessionDescription(data.sdp)) : "";

                    break;
            }
          }else if(data.action === "subRejected"){
            //subscription on this device rejected cos user has subscribed on another device/browser
            console.warn("Maximum of two users allowed in room. Communication disallowed");
        }
    }
  }

  startCall = (isCaller) => {
        this.myPC = new RTCPeerConnection(servers);//RTCPeerconnection obj

        this.myPC.onicecandidate = (e) => {
            if(e.candidate){
                //send my candidate to peer
                this.wsChat.send(JSON.stringify({
                    action: 'candidate',
                    candidate: e.candidate,
                    room: this.room
                }));
            }
        };
        //When remote stream becomes available
        this.myPC.onaddstream = (e) => {
          this.setState({
            remoteStreamURL: e.stream.toURL()
          })
          this.remoteStream = e.stream
        };
        //when remote connection state and ice agent is closed
        this.myPC.oniceconnectionstatechange = () => {
            switch(this.myPC.iceConnectionState){
                case 'disconnected':
                case 'failed':
                    console.warn("Ice connection state is failed/disconnected");
                    // showSnackBar("Call connection problem", 15000);
                    break;

                case 'closed':
                    console.warn("Ice connection state is 'closed'");
                    // showSnackBar("Call connection closed", 15000);
                    break;
            }
        };
        //WHEN REMOTE CLOSES CONNECTION
        this.myPC.onsignalingstatechange = () => {
            switch(this.myPC.signalingState){
                case 'closed':
                    console.log("Signalling state is 'closed'");
                    // showSnackBar("Signal lost", 15000);
                    break;
            }
        };
        // console.log(streamConstraints);
        console.log(isCaller);
        //set local media
        this.setLocalMedia(this.streamConstraints, isCaller);
  }

  setLocalMedia = (streamConstraints, isCaller) => {
    mediaDevices.getUserMedia(
        streamConstraints
    ).then((myStream) => {
        // document.getElementById("myVid").srcObject = myStream;

        this.myPC.addStream(myStream);//add my stream to RTCPeerConnection
        console.warn("getting local stream")

        //set var myMediaStream as the stream gotten. Will be used to remove stream later on

        this.myMediaStream = myStream;
        this.setState({
          localStreamURL: myStream.toURL()
        })
        if(isCaller){
            this.myPC.createOffer().then((desc) => this.description(desc), (e) => {
                console.warn("Error creating offer"+JSON.stringify(e));

                // showSnackBar("Call connection failed", 15000);
            });

            //then notify callee to start call on his end
            this.wsChat.send(JSON.stringify({
                action: 'startCall',
                room: this.room
            }));
        } else{
          console.warn("entered create answer block")
            //myPC.createAnswer(description);
            this.myPC.createAnswer().then((desc) => this.description(desc)).catch((e) => {
                console.warn("Error creating answer   "+JSON.stringify(e.message));
                // showSnackBar("Call connection failed", 15000);
            });
        }
    }).catch((e) => {
        switch(e.name){
            case 'SecurityError':
                console.warn(e.message);
                // showSnackBar("Media sources usage is not supported on this browser/device", 10000);
                break;

            case 'NotAllowedError':
                console.warn(e.message);
                // showSnackBar("We do not have access to your audio/video sources", 10000);
                break;

            case 'NotFoundError':
                console.warn(e.message);
                // showSnackBar("The requested audio/video source cannot be found", 10000);
                break;

            case 'NotReadableError':
            case 'AbortError':
                console.warn(e.message);
                // showSnackBar("Unable to use your media sources", 10000);
                break;
        }
    });
  }

  _call = (isCaller) => {
    this.wsChat.send(JSON.stringify({
                action: 'initCall',
                msg: "Incoming call(Video)",
                room: this.room
            }));
  }

  description = (desc) => {
    this.myPC.setLocalDescription(desc);
    //send sdp
    console.warn("sdp Local     "+JSON.stringify(desc))
    console.log(JSON.stringify(desc))
    this.setState({
      desc:desc.sdp
    })
    this.wsChat.send(JSON.stringify({
        action: 'sdp',
        sdp: desc,
        room: this.room
    }));
  }

  render() {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.welcome}>Welcome to React Native!</Text>
        <TextInput
         multiline = {true}
         value={this.state.desc}
       />
        <TouchableOpacity onPress={() => this._call()}>
          <Text>create call</Text>
        </TouchableOpacity>

        { this.state.localStreamURL &&
                <RTCView streamURL={this.state.localStreamURL} style={styles.rtcView}/>
        }
        { this.state.remoteStreamURL &&
                <RTCView streamURL={this.state.remoteStreamURL} style={styles.rtcView}/>
        }
      </ScrollView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF',
  },
  welcome: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10,
  },
  instructions: {
    textAlign: 'center',
    color: '#333333',
    marginBottom: 5,
  },
  selfView: {
    width: 200,
    height: 150,
  },
  remoteView: {
    width: 200,
    height: 150,
  },
  rtcView: {
    marginTop:20,
    height: 150,
    width: 150,
    backgroundColor: '#f00',
    position: 'relative'
  }
});
