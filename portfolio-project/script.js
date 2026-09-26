"use strict";

// ---------------------------------------------------------------
// วางไฟล์ของคุณตามพาธด้านล่างนี้ก่อน deploy (ชื่อไฟล์เปลี่ยนได้ ขอแค่แก้พาธให้ตรงกัน)
//   - รูปถ่าย/ภาพวาด : assets/photos/*.jpg
//   - วิดีโอทีวี      : assets/video/tv.mp4
//   - โมเดล 3 มิติ    : assets/models/room2.1.glb (มีให้แล้ว)
// ไฟล์ไหนยังไม่มี ระบบจะข้ามไปเฉยๆ ไม่ทำให้หน้าเว็บพัง
// ---------------------------------------------------------------
var MODEL_PATH = "assets/models/room2.1.glb";

var PHOTO_SOURCES = {
  "foto1":       "assets/photos/foto1.jpg",
  "foto2":       "assets/photos/foto2.jpg",
  "foto3":       "assets/photos/foto3.jpg",
  "paint1":      "assets/photos/paint1.jpg",
  "paint3":      "assets/photos/paint3.jpg",
  "paint3.001":  "assets/photos/paint3_001.jpg",
  "paint4":      "assets/photos/paint4.jpg"
};
var VIDEO_SOURCE = "assets/video/tv.mp4";
var TV_NODE_NAME = "tv";
var TARGET_MATERIAL_NAME = "default";

var scene, camera, renderer, controls, raycaster, mouse;
var slots = {};      // nodeName -> { material, kind, video? }
var pickables = [];
var tvVideoEl = null;

init();

function init(){
  var wrap = document.getElementById("canvas-wrap");

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x15161a);

  camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.05, 100);
  camera.position.set(3.2, 2.4, 3.6);

  renderer = new THREE.WebGLRenderer({antialias:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.physicallyCorrectLights = true;
  wrap.appendChild(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 1, 0);
  controls.minDistance = 1;
  controls.maxDistance = 12;
  controls.maxPolarAngle = Math.PI * 0.5;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3a3a, 0.9));
  var key = new THREE.DirectionalLight(0xfff2df, 1.6);
  key.position.set(4, 6, 3);
  scene.add(key);
  var fill = new THREE.DirectionalLight(0xdfeaff, 0.6);
  fill.position.set(-4, 3, -3);
  scene.add(fill);

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  loadModel();

  window.addEventListener("resize", onResize);
  renderer.domElement.addEventListener("click", onClick);
  renderer.domElement.addEventListener("mousemove", onMove);
  document.getElementById("lightboxClose").addEventListener("click", closeLightbox);

  animate();
}

function loadModel(){
  var loader = new THREE.GLTFLoader();
  loader.load(MODEL_PATH, function(gltf){
    var model = gltf.scene;
    scene.add(model);
    setupInteractiveSlots(model);
    autoLoadAssets();
    document.getElementById("loading").style.display = "none";
  }, undefined, function(err){
    document.getElementById("loading").textContent = "โหลดโมเดลไม่สำเร็จ: ตรวจสอบพาธ " + MODEL_PATH;
    console.error(err);
  });
}

// หาชิ้นส่วน (primitive) ภายใต้ node ที่ชื่อกำหนด ซึ่งใช้ material ชื่อ "default"
// แล้ว clone material นั้นให้เป็นอิสระเฉพาะชิ้นนี้ (ของเดิมแชร์ material เดียวกันทุกกรอบ/ทีวี)
function setupInteractiveSlots(root){
  function prepare(nodeName, kind){
    var node = root.getObjectByName(nodeName);
    if (!node) return;
    var found = null;
    node.traverse(function(o){
      if (found || !o.isMesh || !o.material) return;
      if (Array.isArray(o.material)){
        for (var i=0; i<o.material.length; i++){
          if (o.material[i] && o.material[i].name === TARGET_MATERIAL_NAME){
            var cloned = o.material[i].clone();
            cloned.name = TARGET_MATERIAL_NAME + "_" + nodeName;
            o.material[i] = cloned;
            found = cloned;
            break;
          }
        }
      } else if (o.material.name === TARGET_MATERIAL_NAME){
        var cloned2 = o.material.clone();
        cloned2.name = TARGET_MATERIAL_NAME + "_" + nodeName;
        o.material = cloned2;
        found = cloned2;
      }
      if (found) pickables.push(o);
    });
    if (found){
      slots[nodeName] = { material: found, kind: kind };
    }
  }

  Object.keys(PHOTO_SOURCES).forEach(function(n){ prepare(n, "photo"); });
  prepare(TV_NODE_NAME, "video");
}

// โหลดรูป/วิดีโอจากไฟล์ในโปรเจกต์อัตโนมัติ (ไม่ต้องให้ผู้ใช้เลือกไฟล์เอง)
function autoLoadAssets(){
  var texLoader = new THREE.TextureLoader();

  Object.keys(PHOTO_SOURCES).forEach(function(nodeName){
    var slot = slots[nodeName];
    if (!slot) return;
    texLoader.load(
      PHOTO_SOURCES[nodeName],
      function(tex){
        tex.encoding = THREE.sRGBEncoding;
        slot.material.map = tex;
        slot.material.color.set(0xffffff);
        slot.material.needsUpdate = true;
        slot.imageSrc = PHOTO_SOURCES[nodeName];
      },
      undefined,
      function(){ console.warn("ไม่พบไฟล์รูป: " + PHOTO_SOURCES[nodeName]); }
    );
  });

  var tvSlot = slots[TV_NODE_NAME];
  if (tvSlot){
    var video = document.createElement("video");
    video.src = VIDEO_SOURCE;
    video.loop = true;
    video.muted = true;      // เบราว์เซอร์อนุญาต autoplay เมื่อ muted
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    video.addEventListener("loadeddata", function(){
      var tex = new THREE.VideoTexture(video);
      tex.encoding = THREE.sRGBEncoding;
      tvSlot.material.map = tex;
      tvSlot.material.color.set(0xffffff);
      tvSlot.material.needsUpdate = true;
      tvSlot.video = video;
      tvVideoEl = video;
      video.play().catch(function(){});
    });
    video.addEventListener("error", function(){
      console.warn("ไม่พบไฟล์วิดีโอ: " + VIDEO_SOURCE);
    });
  }
}

function resolveSlotName(obj){
  var o = obj;
  while (o){
    if (slots[o.name]) return o.name;
    o = o.parent;
  }
  return null;
}

function onClick(ev){
  var rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  var hits = raycaster.intersectObjects(pickables, false);
  if (!hits.length) return;
  var name = resolveSlotName(hits[0].object);
  if (!name) return;

  var slot = slots[name];
  if (slot.kind === "video" && slot.video){
    if (slot.video.paused){ slot.video.muted = false; slot.video.play(); }
    else { slot.video.pause(); }
    return;
  }
  if (slot.kind === "photo" && slot.imageSrc){
    openLightbox(slot.imageSrc);
  }
}

function onMove(ev){
  var rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  var hits = raycaster.intersectObjects(pickables, false);
  renderer.domElement.style.cursor = (hits.length && resolveSlotName(hits[0].object)) ? "pointer" : "grab";
}

function openLightbox(src){
  document.getElementById("lightboxImg").src = src;
  document.getElementById("lightbox").classList.add("show");
}
function closeLightbox(){
  document.getElementById("lightbox").classList.remove("show");
}

function onResize(){
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate(){
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
