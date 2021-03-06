"use strict";

import 'babel-polyfill';
import 'babylonjs-loaders';
import 'babylonjs-materials';
import * as BABYLON from 'babylonjs';

Array.prototype.getRandomValue = (inputArray) => {
  return inputArray[Math.floor(Math.random() * inputArray.length)];
};

document.addEventListener("DOMContentLoaded", function(){

  class BabylonInstance{

    constructor(){

      this.canvas = document.getElementById('babylon');
      this.engine = new BABYLON.Engine(this.canvas, true);
      this.scene = new BABYLON.Scene(this.engine);
      this.scene.clearColor = new BABYLON.Color4(0,0,0,1);
      this.stare = false;
      this.orientationPermission = false;
      this.gyroscopeActive = false;
      this.hasGyroscope = (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) || navigator.userAgent.match('CriOS') || navigator.userAgent.match('iPhone');
      this.hasWebcam = typeof navigator.mediaDevices !== 'undefined' && typeof navigator.mediaDevices.getUserMedia !== 'undefined';
      this.webcamMobile = false;
      this.firstPersonCenterPercentage = {x: 0, y:0};
      this.buttonWebcam = document.getElementById('cameraButton');
      if(this.hasWebcam){
        this.buttonWebcam.style.display = 'inline-block';
      }
      this.webcamActive = false;
      this.buttonGyroscope = document.getElementById('gyroscope');
      this.buttonCreep = document.getElementById('clickme');
      this.video = document.getElementById('video');

      this.setCamera();
      this.setLights();
      this.loadObjects();
      this.bindEvents();

      this.engine.runRenderLoop(() => {
        this.scene.render();
      });

    }

    bindEvents = () => {
      if(!this.hasGyroscope){
        this.buttonGyroscope.style.display = 'none';
        window.addEventListener("mousemove", this.getMousePosition);
      }
      else{
        this.buttonGyroscope.style.display = 'inline-block';
        window.addEventListener("click", this.getMousePosition);
      }
      this.buttonCreep.addEventListener("click", this.onCreepButtonClick);
      this.buttonWebcam.addEventListener("click", this.onCameraButtonClick);
      window.addEventListener('resize', this.onWindowResize);
      this.onWindowResize();

      this.buttonGyroscope.addEventListener('click', (e) => {
        if(DeviceOrientationEvent && DeviceOrientationEvent.requestPermission){
          this.orientationPermission = DeviceOrientationEvent.requestPermission();
        }
        else{
          this.orientationPermission = true;
        }
        this.gyroscopeActive = !this.gyroscopeActive;
        this.buttonGyroscope.classList.toggle('active');
      });

      if (window.DeviceOrientationEvent) {
        window.addEventListener("deviceorientation", (e) => {
          this.getDevicePosition(Math.abs(e.beta), e.gamma);
        }, true);
      } else if (window.DeviceMotionEvent) {
        window.addEventListener('devicemotion', (e) => {
          console.log(e.acceleration.x, e.acceleration.y);
          this.getDevicePosition(e.acceleration.x * 2, e.acceleration.y * 2);
        }, true);
      }

      if(this.hasWebcam){
        this.video.addEventListener('play', this.getWebcamPosition);
      }

    }

    getWebcamPosition = () => {
      this.faceDetectionCanvas = faceapi.createCanvasFromMedia(video);
      this.faceDetectionCanvas.id = 'faceDetectionCanvas';
      this.faceDetectionCanvas.width = this.video.width;
      this.faceDetectionCanvas.height = this.video.height;
      document.getElementById('buttons').append(this.faceDetectionCanvas);
      const displaySize = { width: this.video.width, height: this.video.height };
      faceapi.matchDimensions(this.video, displaySize);

      setInterval(async () => {
        const detections = await faceapi.detectAllFaces(this.video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();
        const resizedDetections = faceapi.resizeResults(detections, displaySize);

        this.faceDetectionCanvas.getContext('2d').clearRect(0, 0, this.faceDetectionCanvas.width, this.faceDetectionCanvas.height)
        faceapi.draw.drawDetections(this.faceDetectionCanvas, resizedDetections)

        if(resizedDetections.length){

          const firstPerson = {
            height: resizedDetections[0].detection.box._height,
            width: resizedDetections[0].detection.box._width,
            left: resizedDetections[0].detection.box._x,
            top: resizedDetections[0].detection.box._y
          };
          const firstPersonCenter = {
            x: firstPerson.left + firstPerson.width / 2,
            y: firstPerson.top + firstPerson.height / 2
          };
          const firstPersonCenterPercentage = {
            x: 100 / this.video.width * firstPersonCenter.x,
            y: 100 / this.video.height * firstPersonCenter.y - 10
          };

          let surfacePercentage;
          if(this.video.height < this.video.width){
            surfacePercentage = 100 / this.video.height * firstPerson.height;
          }
          else{
            surfacePercentage = 100 / this.video.width * firstPerson.width;
          }
          this.setHeadPosition(surfacePercentage * 0.7 - 10);

          const shakyToleranceX = !this.webcamMobile ? 0.25 : 0.05;
          const shakyToleranceY = !this.webcamMobile ? 0.4 : 0.05;
          let relativeX, relativeY;
          if(Math.abs(firstPersonCenterPercentage.x - this.firstPersonCenterPercentage.x) >= shakyToleranceX){
            relativeX = 100 - firstPersonCenterPercentage.x;
            relativeY = this.webcamMobile ? this.firstPersonCenterPercentage.y - 20 : this.firstPersonCenterPercentage.y + 5;
            this.turnHead(relativeX, relativeY);
            this.firstPersonCenterPercentage = firstPersonCenterPercentage;
          }
          if(Math.abs(firstPersonCenterPercentage.y - this.firstPersonCenterPercentage.y) >= shakyToleranceY){
            relativeX = 100 - this.firstPersonCenterPercentage.x;
            relativeY = this.webcamMobile ? firstPersonCenterPercentage.y - 20 : firstPersonCenterPercentage.y + 5;
            this.turnHead(relativeX, relativeY);
            this.firstPersonCenterPercentage = firstPersonCenterPercentage;
          }

        }

      }, 30);
    }

    startWebcam = () => {

      const _this = this;
      this.video.setAttribute('autoplay', true);
      this.video.setAttribute('muted', true);
      this.video.setAttribute('playsinline', true);

      if(typeof navigator.getUserMedia !== 'undefined'){
        navigator.getUserMedia({
          audio: false,
          video: {
            width: this.video.width,
            height: this.video.height
          },
        },
        stream => {
          video.srcObject = stream;
          _this.webcamStream = stream;
        },
        err => {
          console.log('webcam error');
          console.error(err);
        });
      }
      else if(typeof navigator.mediaDevices.getUserMedia !== 'undefined'){
        navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: 'user',
            width: this.video.width,
            height: this.video.height
          },
        })
        .then((stream) => {
          const width = this.video.width;
          const height = this.video.height;
          this.video.width = height;
          this.video.height = width;
          _this.webcamMobile = true;
          _this.webcamStream = stream;
          video.srcObject = stream;
          video.onloadedmetadata = (e) => {
            video.play();
          };
        })
        .catch((err) => {
          console.log(err.name + ": " + err.message);
        });
      }

    }

    getDevicePosition = (x, y) => {

      if(this.gyroscopeActive){

        let relativeYPositionPercentage = 100 / 180 * (x - 30) * 2.6;
        relativeYPositionPercentage <= 0 ? relativeYPositionPercentage = 0 : null;
        relativeYPositionPercentage >= 100 ? relativeYPositionPercentage = 100 : null;

        let relativeXPositionPercentage = 100 / 180 * (y + 45) * 2.6;
        relativeXPositionPercentage <= 0  ? relativeXPositionPercentage = 0 : null;
        relativeXPositionPercentage >= 100 ? relativeXPositionPercentage = 100 : null;

        this.turnHead(relativeXPositionPercentage, relativeYPositionPercentage);
      }

    }

    setCamera = () => {
      // UniversalCamera
      const camera = this.camera = new BABYLON.UniversalCamera("camera", new BABYLON.Vector3(0, 0, 800), this.scene);
      camera.setTarget(BABYLON.Vector3.Zero());

      // // ArcRotateCamera
      // const camera = new BABYLON.ArcRotateCamera("camera", 0, 0, 400, new BABYLON.Vector3(0,0,0), this.scene);
      // camera.alpha = Math.PI / 180 * 75;
      // camera.beta = Math.PI / 180 * 90;
      // camera.lowerAlphaLimit = Math.PI / 180 * 30; // or any radian value
      // camera.upperAlphaLimit = Math.PI / 180 * 150; // or any radian value
      // camera.lowerBetaLimit = Math.PI / 180 * 60; // or any radian value
      // camera.upperBetaLimit = Math.PI / 180 * 120; // or any radian value
      // camera.attachControl(this.canvas, true);

      camera.lowerRadiusLimit = 400;
      camera.upperRadiusLimit = 400;
    }

    loadObjects = () => {
      const _this = this;

      // The first parameter can be set to null to load all meshes and skeletons
      BABYLON.SceneLoader.ImportMesh("", "./dist/obj/", "head3d.obj", this.scene, function (meshes, particleSystems, skeletons) {

        const loader = document.getElementById('loader');
        loader.parentNode.removeChild(loader);

        /*
          ---
          0 -> Head
          ---
          1 -> Eyeball right
          2 -> ?
          3 -> pupil right
          4 -> lens right
          ---
          5 -> Eyeball left
          6 -> ?
          7 -> pupil left
          8 -> lens left
          ---
        */

        // both eyeballs
        meshes[1].material.diffuseColor = new BABYLON.Color3(0.54, 0.5, 0.54);
        meshes[1].material.specularColor = new BABYLON.Color3(0.1,0.1,0.1);

        // both ???
        meshes[2].material.diffuseColor = new BABYLON.Color3(0.0,0);
        meshes[2].material.specularColor = new BABYLON.Color3(0,0,0);

        // both irises
        _this.irisRight = meshes[3];
        _this.irisRight.material.diffuseColor = new BABYLON.Color3(1 / 255 * 45, 1 / 255 * 22.5, 0);
        _this.irisRight.material.specularColor = new BABYLON.Color3(0, 0, 0);

        // both lenses
        meshes[4].material.alpha = 0.2;
        meshes[4].material.diffuseColor = new BABYLON.Color3(1,1,1);
        meshes[4].material.specularColor = new BABYLON.Color3(1,1,1);

        // head
        _this.head = meshes[0];
        _this.head.material.emissiveColor = new BABYLON.Color3(0, 0, 0);
        if(_this.hasGyroscope){
          _this.head.material.specularColor = new BABYLON.Color3(0.025, 0.025, 0.05);
        }
        else{
          _this.head.material.specularColor = new BABYLON.Color3(0.05, 0.05, 0.1);
        }
        _this.head.material.diffuseTexture.hasAlpha = true;
        _this.head.material.backFaceCulling = false;
        // _this.head.material.alpha = 0.9;

        _this.head.maxRotationX = Math.PI / 180 * 30;
        _this.head.minRotationX = Math.PI / 180 * -30;
        _this.head.rangeRotationX = Math.PI / 180 * 60;

        _this.head.maxRotationY = Math.PI / 180 * 45;
        _this.head.minRotationY = Math.PI / 180 * -45;
        _this.head.rangeRotationY = Math.PI / 180 * 90;

        _this.pivotEyeRight = new BABYLON.TransformNode('pivotEyeRight');
        _this.pivotEyeRight.position = new BABYLON.Vector3(29.4,27,71.5);
        _this.pivotEyeRight.parent = _this.head;

        _this.pivotEyeRight.maxRotationY = Math.PI / 180 * 5;
        _this.pivotEyeRight.minRotationY = Math.PI / 180 * -5;
        _this.pivotEyeRight.rangeRotationY = Math.PI / 180 * 10;
        _this.pivotEyeRight.maxRotationX = Math.PI / 180 * 12.5;
        _this.pivotEyeRight.minRotationX = Math.PI / 180 * -12.5;
        _this.pivotEyeRight.rangeRotationX = Math.PI / 180 * 25;

        const pupilRight = new BABYLON.MeshBuilder.CreateSphere("pupilRight", {diameter: 8, diameterY: 2, slice: 0.5}, _this.scene);
        pupilRight.parent = _this.pivotEyeRight;
        pupilRight.position.z = 13;
        pupilRight.position.y = -3.5;
        pupilRight.position.x = 2;
        pupilRight.rotation.x = Math.PI / 2;

        const pupilRightMaterial = new BABYLON.StandardMaterial("pupilRightMaterial", _this.scene);
        pupilRightMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
        pupilRightMaterial.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        pupilRightMaterial.backFaceCulling = false;
        pupilRight.material = pupilRightMaterial;

        meshes[1].parent = _this.pivotEyeRight;
        meshes[2].parent = _this.pivotEyeRight;
        meshes[3].parent = _this.pivotEyeRight;
        meshes[4].parent = _this.pivotEyeRight;

        const translateRight = new BABYLON.Vector3(-29.4,-27,-71.5);
        meshes[1].position = translateRight;
        meshes[2].position = translateRight;
        meshes[3].position = translateRight;
        meshes[4].position = translateRight;

        // const test = new BABYLON.MeshBuilder.CreateSphere("test", {diameter: 29}, _this.scene);
        // test.parent = _this.pivotEyeRight;
        // test.alpha = 0.5;
        // var myMaterial = new BABYLON.StandardMaterial("myMaterial", _this.scene);
        // myMaterial.diffuseColor = new BABYLON.Color3(1, 0, 0);
        // test.material = myMaterial;
        // test.material.alpha = 0.5;

        //

        _this.pivotEyeLeft = new BABYLON.TransformNode('pivotEyeLeft');
        _this.pivotEyeLeft.position = new BABYLON.Vector3(-29.4,27,71.5);
        _this.pivotEyeLeft.parent = _this.head;

        _this.pivotEyeLeft.maxRotationY = Math.PI / 180 * 10;
        _this.pivotEyeLeft.minRotationY = Math.PI / 180 * -10;
        _this.pivotEyeLeft.rangeRotationY = Math.PI / 180 * 20;
        _this.pivotEyeLeft.maxRotationX = Math.PI / 180 * 12.5;
        _this.pivotEyeLeft.minRotationX = Math.PI / 180 * -12.5;
        _this.pivotEyeLeft.rangeRotationX = Math.PI / 180 * 25;

        const pupilLeft = new BABYLON.MeshBuilder.CreateSphere("pupilLeft", {diameter: 8, diameterY: 2, slice: 0.5}, _this.scene);
        pupilLeft.parent = _this.pivotEyeLeft;
        pupilLeft.position.z = 13;
        pupilLeft.position.y = -3.5;
        pupilLeft.position.x = 0;
        pupilLeft.rotation.x = Math.PI / 2;

        const pupilLeftMaterial = new BABYLON.StandardMaterial("pupilLeftMaterial", _this.scene);
        pupilLeftMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
        pupilLeftMaterial.specularColor = new BABYLON.Color3(1, 0.2, 0.2);
        pupilLeftMaterial.backFaceCulling = false;
        pupilLeft.material = pupilLeftMaterial;

        meshes[5].parent = _this.pivotEyeLeft;
        meshes[6].parent = _this.pivotEyeLeft;
        meshes[7].parent = _this.pivotEyeLeft;
        meshes[8].parent = _this.pivotEyeLeft;

        const translateLeft = new BABYLON.Vector3(29.4,-27,-71.5);
        meshes[5].position = translateLeft;
        meshes[6].position = translateLeft;
        meshes[7].position = translateLeft;
        meshes[8].position = translateLeft;

      });
    }

    onCameraButtonClick = (e) => {
      this.stare = false;
      this.gyroscopeActive = false;
      this.webcamActive = !this.webcamActive;
      this.buttonCreep.classList.remove('active');
      this.buttonGyroscope.classList.remove('active');
      this.buttonWebcam.classList.toggle('active');

      if(this.webcamActive){
        Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
          faceapi.nets.faceExpressionNet.loadFromUri('/models')
        ]).then(() => {
          this.video.style.visibility = 'visible';
          this.startWebcam();
        }).catch((error) => {
          console.log("Promise Rejected");
          console.log(error);
        });
        window.removeEventListener("mousemove", this.getMousePosition);
      }
      else{
        this.webcamStream.getTracks().forEach(track => track.stop());
        this.video.removeEventListener('play', this.getWebcamPosition);
        this.video.style.visibility = 'hidden';
        this.setHeadPosition(0);

        if(!this.hasGyroscope){
          window.addEventListener("mousemove", this.getMousePosition);
        }
      }

    }

    onCreepButtonClick = (e) => {
      this.stare = !this.stare
      this.buttonCreep.classList.toggle('active');
      if(!this.webcamActive){
        this.getMousePosition(e);
      }
    }

    setLights = () => {
      const hemisphericLight = new BABYLON.HemisphericLight("hemisphericLight", new BABYLON.Vector3(0, 200, 0), this.scene);
      hemisphericLight.diffuse = new BABYLON.Color3(1, 1, 1);

      const lightIntensity = 1;
      const spotLightFront = new BABYLON.SpotLight('spotLightFront', new BABYLON.Vector3(0, 0, 400), new BABYLON.Vector3(0, 0, 0), Math.PI * 2, 0, this.scene);
      spotLightFront.intensity = lightIntensity;
      const spotLightLeft = new BABYLON.SpotLight('spotLightLeft', new BABYLON.Vector3(400, -200, 100), new BABYLON.Vector3(0, 0, 0), Math.PI * 2, 0, this.scene);
      spotLightLeft.intensity = lightIntensity;
      const spotLightRight = new BABYLON.SpotLight('spotLightRight', new BABYLON.Vector3(-400, -200, 100), new BABYLON.Vector3(0, 0, 0), Math.PI * 2, 0, this.scene);
      spotLightRight.intensity = lightIntensity;
      const spotLightLower = new BABYLON.SpotLight('spotLightLower', new BABYLON.Vector3(0, -200, 200), new BABYLON.Vector3(0, 0, 0), Math.PI * 2, 0, this.scene);
      spotLightLower.intensity = lightIntensity;

      if(this.hasGyroscope){
        hemisphericLight.intensity = 2;
        spotLightFront.position.z = 300;
        spotLightLeft.position.x = 300;
        spotLightRight.position.x = -300;
      }
    }

    getMousePosition = (e) => {
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const mousePosXPercentage = 100 / windowWidth * e.clientX;
      const mousePosYPercentage = 100 / windowHeight * e.clientY;
      if(!this.gyroscopeActive){
        this.turnHead(mousePosXPercentage, mousePosYPercentage);
      }
    }

    setHeadPosition = (percentage) => {
      const head = this.head;
      const maxDistance = this.webcamMobile ? 400 : 700;
      const tolerance = this.webcamMobile ? 20 : 30;
      const newPos = maxDistance / 100 * percentage;
      if(Math.abs(head.position.z - newPos) >= tolerance){
        head.position.z = newPos;
      }
    }

    turnHead = (x, y) => {

      if(this.head){

        const head = this.head;
        let turnXHead, turnYHead;
        turnXHead = (head.rangeRotationX / 100 * x + head.minRotationX) * -1;
        turnYHead = head.rangeRotationY / 100 * y + head.minRotationY;
        head.rotation.x = turnYHead;
        head.rotation.y = turnXHead;

        const starePosition = 150;
        const animationLength = 5;
        const animationBox = new BABYLON.Animation("headMoveAnimation", "position.z", 60, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
        const keys = [
          {
            frame: 0,
            value: 0
          },
          {
            frame: animationLength,
            value: starePosition
          }
        ];
        animationBox.setKeys(keys);
        head.animations.push(animationBox);
        if(!this.webcamActive){
          if(this.stare){
            if(head.position.z <= 5){
              this.scene.beginAnimation(head, 0, animationLength, true);
              this.irisRight.material.diffuseColor = new BABYLON.Color3(1 / 255 * 70, 0, 0);
              this.irisRight.material.specularColor = new BABYLON.Color3(0.7,0.7,0.7);
            }
          }
          else{
            if(head.position.z >= starePosition - 5){
              this.scene.beginAnimation(head, animationLength, 0, true);
              this.irisRight.material.diffuseColor = new BABYLON.Color3(1 / 255 * 45, 1 / 255 * 22.5, 0);
              this.irisRight.material.specularColor = new BABYLON.Color3(0, 0, 0);
              this.head.material.diffuseColor = new BABYLON.Color4(1,1,1,0);
            }
          }
        }

        const webcamFactor = -0.5;
        const mobileWebcamFactorX = -1;
        const mobileWebcamFactorY = -1.2;
        const stareFactor = -1.8;

        const eyeLeft = this.pivotEyeLeft;
        let turnXEyeLeftOrigin = (eyeLeft.rangeRotationX / 100 * x + eyeLeft.minRotationX) * -1;
        let turnYEyeLeftOrigin = eyeLeft.rangeRotationY / 100 * y + eyeLeft.minRotationY;
        let turnXEyeLeft = turnXEyeLeftOrigin;
        let turnYEyeLeft = turnYEyeLeftOrigin;

        this.webcamActive ? turnXEyeLeft = turnXEyeLeftOrigin * webcamFactor : null;
        this.webcamActive ? turnYEyeLeft = turnYEyeLeftOrigin * webcamFactor : null;
        this.stare ? turnXEyeLeft =  turnXEyeLeftOrigin * stareFactor : null;
        this.stare ? turnYEyeLeft =  turnYEyeLeftOrigin * stareFactor : null;
        this.webcamMobile ? turnXEyeLeft =  turnXEyeLeftOrigin * mobileWebcamFactorX : null;
        this.webcamMobile ? turnYEyeLeft =  turnYEyeLeftOrigin * mobileWebcamFactorY : null;
        eyeLeft.rotation.x = turnYEyeLeft;
        eyeLeft.rotation.y = turnXEyeLeft;

        const eyeRight = this.pivotEyeRight;
        let turnXEyeRightOrigin = (eyeRight.rangeRotationX / 100 * x + eyeRight.minRotationX) * -1;
        let turnYEyeRightOrigin = eyeRight.rangeRotationY / 100 * y + eyeRight.minRotationY;
        let turnXEyeRight = turnXEyeRightOrigin;
        let turnYEyeRight = turnYEyeRightOrigin;

        this.webcamActive ? turnXEyeRight = turnXEyeRightOrigin * webcamFactor : null;
        this.webcamActive ? turnYEyeRight = turnYEyeRightOrigin * webcamFactor : null;
        this.stare ? turnXEyeRight = turnXEyeRightOrigin * stareFactor : null;
        this.stare ? turnYEyeRight = turnYEyeRightOrigin * stareFactor : null;
        this.webcamMobile ? turnXEyeRight = turnXEyeRightOrigin * mobileWebcamFactorX : null;
        this.webcamMobile ? turnYEyeRight = turnYEyeRightOrigin * mobileWebcamFactorY : null;
        eyeRight.rotation.x = turnYEyeRight;
        eyeRight.rotation.y = turnXEyeRight;

      }

    }

    onWindowResize = (e) => {
      const windowWidth = window.innerWidth;

      if(windowWidth < 768){
        this.camera.position.z = 550;
      }
      else if(windowWidth < 1024){
        this.camera.position.z = 650;
      }
      else{
        this.camera.position.z = 800;
      }

    }

  }

  window.babylonInstance = new BabylonInstance();

});
