import * as THREE from 'three';

export function createScene(container) {
  const scene = new THREE.Scene();

  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 20, 120);

  const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.5, 200);
  camera.position.set(20, 12, 18);
  camera.lookAt(0, 4, -3);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0x8899bb, 1.2);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xffeedd, 5);
  sunLight.position.set(25, 30, 10);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 120;
  sunLight.shadow.camera.left = -40;
  sunLight.shadow.camera.right = 40;
  sunLight.shadow.camera.top = 40;
  sunLight.shadow.camera.bottom = -40;
  sunLight.shadow.bias = -0.0001;
  scene.add(sunLight);

  const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x445544, 0.8);
  scene.add(hemiLight);

  const sceneObjects = {
    damGroup: new THREE.Group(),
    reservoirGroup: new THREE.Group(),
    spillwayGroup: new THREE.Group(),
    turbineAssembly: new THREE.Group(),
    internalRoom: new THREE.Group(),
    waterFlowParticles: null,
    mistParticles: null,
    rainParticles: null,
    waterPlane: null,
    turbineBlades: null,
    turbineHousing: null,
    generatorBody: null,
    spillwayLeftGate: null,
    spillwayRightGate: null,
    spillwayLeftWater: null,
    spillwayRightWater: null,
    generatorGlow: null,
    internalWalls: [],
    riverWater: null,
    rainMesh: null,
    damMainBody: null
  };

  createTerrain(scene);
  createRiverDownstream(scene, sceneObjects);
  createDam(scene, sceneObjects);
  createReservoir(scene, sceneObjects);
  createSpillway(scene, sceneObjects);
  createTurbineAssembly(scene, sceneObjects);
  createInternalRoom(scene, sceneObjects);
  createParticleSystems(scene, sceneObjects);
  createDecorations(scene);

  return { scene, camera, renderer, sceneObjects };
}

function createTerrain(scene) {
  const groundGeo = new THREE.PlaneGeometry(120, 120);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x3a6b3a,
    roughness: 0.9,
    metalness: 0.05
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.1;
  ground.receiveShadow = true;
  scene.add(ground);

  const mountainGeo = new THREE.ConeGeometry(8, 18, 8, 3);
  const mountainMat = new THREE.MeshStandardMaterial({
    color: 0x4a7a3a,
    roughness: 0.8,
    metalness: 0.05
  });
  const positions = [
    [-18, 9, -20], [18, 9, -20], [-20, 8, -25],
    [20, 8, -25], [-14, 6, -30], [14, 7, -30]
  ];
  positions.forEach(([x, h, z]) => {
    const mountain = new THREE.Mesh(mountainGeo, mountainMat);
    mountain.position.set(x, h / 2, z);
    mountain.scale.set(1, 1, 1);
    mountain.receiveShadow = true;
    mountain.castShadow = true;
    scene.add(mountain);
  });

  const hillGeo = new THREE.SphereGeometry(4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const hillMat = new THREE.MeshStandardMaterial({ color: 0x5a8a4a, roughness: 0.8 });
  for (let i = 0; i < 15; i++) {
    const hill = new THREE.Mesh(hillGeo, hillMat);
    const angle = (Math.random() - 0.5) * Math.PI;
    const dist = 25 + Math.random() * 30;
    hill.position.set(Math.cos(angle) * dist, 0, -20 - Math.random() * 20);
    hill.scale.set(0.5 + Math.random() * 1.5, 0.3 + Math.random() * 0.8, 0.5 + Math.random());
    hill.receiveShadow = true;
    scene.add(hill);
  }
}

function createRiverDownstream(scene, obj) {
  const riverGeo = new THREE.PlaneGeometry(6, 20);
  const riverMat = new THREE.MeshStandardMaterial({
    color: 0x2980b9,
    roughness: 0.3,
    metalness: 0.4,
    transparent: true,
    opacity: 0.7
  });
  obj.riverWater = new THREE.Mesh(riverGeo, riverMat);
  obj.riverWater.rotation.x = -Math.PI / 2;
  obj.riverWater.position.set(0, 0.05, 10);
  obj.riverWater.receiveShadow = true;
  scene.add(obj.riverWater);

  const bankGeo = new THREE.BoxGeometry(6, 1.5, 20);
  const bankMat = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.9 });
  const leftBank = new THREE.Mesh(bankGeo, bankMat);
  leftBank.position.set(-6, 0.6, 10);
  leftBank.receiveShadow = true;
  leftBank.castShadow = true;
  scene.add(leftBank);
  const rightBank = new THREE.Mesh(bankGeo, bankMat);
  rightBank.position.set(6, 0.6, 10);
  rightBank.receiveShadow = true;
  rightBank.castShadow = true;
  scene.add(rightBank);
}

function createDam(scene, obj) {
  const damGroup = obj.damGroup;
  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0xb8b8c0,
    roughness: 0.55,
    metalness: 0.15
  });
  const darkConcreteMat = new THREE.MeshStandardMaterial({
    color: 0x909098,
    roughness: 0.6,
    metalness: 0.1
  });

  const mainBodyGeo = new THREE.BoxGeometry(16, 10, 4);
  const mainBody = new THREE.Mesh(mainBodyGeo, concreteMat);
  mainBody.position.set(0, 5, -2);
  mainBody.castShadow = true;
  mainBody.receiveShadow = true;
  damGroup.add(mainBody);
  obj.damMainBody = mainBody;

  const topGeo = new THREE.BoxGeometry(16.5, 0.8, 4.5);
  const top = new THREE.Mesh(topGeo, new THREE.MeshStandardMaterial({
    color: 0xc8c8d0, roughness: 0.4, metalness: 0.2
  }));
  top.position.set(0, 10.2, -2);
  top.castShadow = true;
  damGroup.add(top);

  const railingGeo1 = new THREE.BoxGeometry(0.2, 1.2, 0.2);
  const railingMat = new THREE.MeshStandardMaterial({ color: 0x707078, metalness: 0.6, roughness: 0.3 });
  for (let x = -7.5; x <= 7.5; x += 0.8) {
    const post = new THREE.Mesh(railingGeo1, railingMat);
    post.position.set(x, 11, -4.2);
    damGroup.add(post);
    const post2 = new THREE.Mesh(railingGeo1, railingMat);
    post2.position.set(x, 11, 0.2);
    damGroup.add(post2);
  }
  const railGeo = new THREE.BoxGeometry(16.5, 0.15, 0.15);
  const rail1 = new THREE.Mesh(railGeo, railingMat);
  rail1.position.set(0, 11.5, -4.2);
  damGroup.add(rail1);
  const rail2 = new THREE.Mesh(railGeo, railingMat);
  rail2.position.set(0, 11.5, 0.2);
  damGroup.add(rail2);

  const gatePositions = [-5, 0, 5];
  gatePositions.forEach(gx => {
    const gateRecessGeo = new THREE.BoxGeometry(2.2, 3.2, 0.3);
    const gateRecess = new THREE.Mesh(gateRecessGeo, darkConcreteMat);
    gateRecess.position.set(gx, 2.5, 0.05);
    damGroup.add(gateRecess);

    const gateFrameGeo = new THREE.BoxGeometry(2.5, 3.5, 0.15);
    const gateFrame = new THREE.Mesh(gateFrameGeo, new THREE.MeshStandardMaterial({
      color: 0x606068, roughness: 0.3, metalness: 0.5
    }));
    gateFrame.position.set(gx, 2.5, 0.02);
    damGroup.add(gateFrame);

    const pipeGeo = new THREE.CylinderGeometry(1.8, 1.8, 3, 16);
    const pipe = new THREE.Mesh(pipeGeo, new THREE.MeshStandardMaterial({
      color: 0x505058, roughness: 0.3, metalness: 0.6
    }));
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(gx, 1.5, -1.5);
    damGroup.add(pipe);
  });

  const wallDetailGeo = new THREE.BoxGeometry(0.3, 0.3, 4.1);
  for (let y = 0.5; y <= 9.5; y += 1.5) {
    const detail = new THREE.Mesh(wallDetailGeo, darkConcreteMat);
    detail.position.set(0, y, -2);
    damGroup.add(detail);
  }

  scene.add(damGroup);
}

function createReservoir(scene, obj) {
  const waterGeo = new THREE.PlaneGeometry(28, 26, 30, 30);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshPhongMaterial({
    color: 0x1a6bb0,
    specular: 0x88aacc,
    shininess: 60,
    transparent: true,
    opacity: 0.75,
    side: THREE.DoubleSide
  });
  obj.waterPlane = new THREE.Mesh(waterGeo, waterMat);
  obj.waterPlane.position.set(0, 6, -15);
  obj.waterPlane.receiveShadow = true;
  obj.reservoirGroup.add(obj.waterPlane);

  const bedGeo = new THREE.PlaneGeometry(28, 26);
  const bedMat = new THREE.MeshStandardMaterial({ color: 0x3a5a3a, roughness: 0.95 });
  const bed = new THREE.Mesh(bedGeo, bedMat);
  bed.rotation.x = -Math.PI / 2;
  bed.position.set(0, -0.05, -15);
  bed.receiveShadow = true;
  obj.reservoirGroup.add(bed);

  scene.add(obj.reservoirGroup);
}

function createSpillway(scene, obj) {
  const spillGroup = obj.spillwayGroup;
  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0xa0a0a8, roughness: 0.5, metalness: 0.1
  });

  [-8, 8].forEach(sideX => {
    const channelGeo = new THREE.BoxGeometry(2, 10, 1.5);
    const channel = new THREE.Mesh(channelGeo, concreteMat);
    channel.position.set(sideX, 4.5, -3.5);
    channel.castShadow = true;
    channel.receiveShadow = true;
    spillGroup.add(channel);

    const wallGeo = new THREE.BoxGeometry(0.3, 10, 1.5);
    const outerWall = new THREE.Mesh(wallGeo, concreteMat);
    outerWall.position.set(sideX + (sideX > 0 ? 1.15 : -1.15), 4.5, -3.5);
    spillGroup.add(outerWall);

    const slopeGeo = new THREE.BoxGeometry(1.4, 2, 6);
    const slope = new THREE.Mesh(slopeGeo, concreteMat);
    slope.position.set(sideX, 0.3, -0.5);
    slope.rotation.x = -0.35;
    slope.castShadow = true;
    slope.receiveShadow = true;
    spillGroup.add(slope);
  });

  const leftGateGeo = new THREE.BoxGeometry(1.6, 0.3, 1.2);
  const gateMat = new THREE.MeshStandardMaterial({ color: 0x707078, roughness: 0.3, metalness: 0.7 });
  obj.spillwayLeftGate = new THREE.Mesh(leftGateGeo, gateMat);
  obj.spillwayLeftGate.position.set(-8, 9.8, -3.5);
  spillGroup.add(obj.spillwayLeftGate);

  obj.spillwayRightGate = new THREE.Mesh(leftGateGeo.clone(), gateMat);
  obj.spillwayRightGate.position.set(8, 9.8, -3.5);
  spillGroup.add(obj.spillwayRightGate);

  const leftWaterGeo = new THREE.PlaneGeometry(1.4, 5);
  const waterFallMat = new THREE.MeshBasicMaterial({
    color: 0x88ccff,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide
  });
  obj.spillwayLeftWater = new THREE.Mesh(leftWaterGeo, waterFallMat);
  obj.spillwayLeftWater.position.set(-8, 6.5, 0.5);
  obj.spillwayLeftWater.rotation.x = -0.35;
  obj.spillwayLeftWater.visible = false;
  spillGroup.add(obj.spillwayLeftWater);

  obj.spillwayRightWater = new THREE.Mesh(leftWaterGeo.clone(), waterFallMat);
  obj.spillwayRightWater.position.set(8, 6.5, 0.5);
  obj.spillwayRightWater.rotation.x = -0.35;
  obj.spillwayRightWater.visible = false;
  spillGroup.add(obj.spillwayRightWater);

  scene.add(spillGroup);
}

function createTurbineAssembly(scene, obj) {
  const group = obj.turbineAssembly;

  const housingGeo = new THREE.CylinderGeometry(1.5, 1.5, 2, 32);
  const housingMat = new THREE.MeshStandardMaterial({
    color: 0x606068, roughness: 0.3, metalness: 0.7
  });
  obj.turbineHousing = new THREE.Mesh(housingGeo, housingMat);
  obj.turbineHousing.rotation.z = Math.PI / 2;
  obj.turbineHousing.position.set(0, 1.5, -1.5);
  obj.turbineHousing.castShadow = true;
  obj.turbineHousing.receiveShadow = true;
  group.add(obj.turbineHousing);

  const bladeGroup = new THREE.Group();
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0x909098, roughness: 0.25, metalness: 0.8
  });
  for (let i = 0; i < 8; i++) {
    const bladeGeo = new THREE.BoxGeometry(0.15, 2.6, 0.6);
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.y = 0;
    blade.rotation.y = (i / 8) * Math.PI * 2;
    blade.rotation.order = 'YXZ';
    const angle = (i / 8) * Math.PI * 2;
    blade.position.x = Math.cos(angle) * 1.0;
    blade.position.z = Math.sin(angle) * 1.0;
    blade.lookAt(new THREE.Vector3(Math.cos(angle + Math.PI / 2) * 2, 0, Math.sin(angle + Math.PI / 2) * 2));
    blade.castShadow = true;
    bladeGroup.add(blade);
  }
  bladeGroup.position.set(0, 1.5, -1.5);
  bladeGroup.rotation.z = Math.PI / 2;
  obj.turbineBlades = bladeGroup;
  group.add(bladeGroup);

  const shaftGeo = new THREE.CylinderGeometry(0.2, 0.2, 3.5, 16);
  const shaftMat = new THREE.MeshStandardMaterial({
    color: 0x808088, roughness: 0.2, metalness: 0.9
  });
  const shaft = new THREE.Mesh(shaftGeo, shaftMat);
  shaft.position.set(0, 3.5, -1.5);
  shaft.castShadow = true;
  group.add(shaft);

  const genHousingGeo = new THREE.CylinderGeometry(1.8, 1.8, 3, 32);
  const genHousingMat = new THREE.MeshStandardMaterial({
    color: 0x5588aa, roughness: 0.3, metalness: 0.5
  });
  obj.generatorBody = new THREE.Mesh(genHousingGeo, genHousingMat);
  obj.generatorBody.position.set(0, 6.5, -1.5);
  obj.generatorBody.castShadow = true;
  obj.generatorBody.receiveShadow = true;
  group.add(obj.generatorBody);

  const coilGeo = new THREE.TorusGeometry(1.6, 0.15, 8, 16);
  const coilMat = new THREE.MeshStandardMaterial({
    color: 0xcc7733, roughness: 0.4, metalness: 0.9, emissive: 0x331100, emissiveIntensity: 0.3
  });
  for (let y = 5.3; y <= 7.7; y += 0.6) {
    const coil = new THREE.Mesh(coilGeo, coilMat);
    coil.position.set(0, y, -1.5);
    group.add(coil);
  }

  const glowGeo = new THREE.SphereGeometry(0.3, 16, 16);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.0 });
  obj.generatorGlow = new THREE.Mesh(glowGeo, glowMat);
  obj.generatorGlow.position.set(0, 6.5, -1.5);
  group.add(obj.generatorGlow);

  scene.add(group);
}

function createInternalRoom(scene, obj) {
  const room = obj.internalRoom;
  const roomMat = new THREE.MeshStandardMaterial({
    color: 0x707078, roughness: 0.5, metalness: 0.2, side: THREE.BackSide
  });

  const floorGeo = new THREE.PlaneGeometry(6, 8);
  const floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({
    color: 0x606068, roughness: 0.4, metalness: 0.3
  }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.02, -1.5);
  room.add(floor);
  obj.internalWalls.push(floor);

  const backWallGeo = new THREE.PlaneGeometry(6, 8);
  const backWall = new THREE.Mesh(backWallGeo, new THREE.MeshStandardMaterial({
    color: 0x808088, roughness: 0.5, metalness: 0.2
  }));
  backWall.position.set(0, 4, -4);
  room.add(backWall);
  obj.internalWalls.push(backWall);

  const leftWallGeo = new THREE.PlaneGeometry(8, 8);
  const leftWall = new THREE.Mesh(leftWallGeo, new THREE.MeshStandardMaterial({
    color: 0x787880, roughness: 0.5, metalness: 0.2
  }));
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-3, 4, -1.5);
  room.add(leftWall);
  obj.internalWalls.push(leftWall);

  const rightWallGeo = new THREE.PlaneGeometry(8, 8);
  const rightWall = new THREE.Mesh(rightWallGeo, new THREE.MeshStandardMaterial({
    color: 0x787880, roughness: 0.5, metalness: 0.2
  }));
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(3, 4, -1.5);
  room.add(rightWall);
  obj.internalWalls.push(rightWall);

  const ceilingGeo = new THREE.PlaneGeometry(6, 8);
  const ceiling = new THREE.Mesh(ceilingGeo, new THREE.MeshStandardMaterial({
    color: 0x686870, roughness: 0.5, metalness: 0.2
  }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, 8, -1.5);
  room.add(ceiling);
  obj.internalWalls.push(ceiling);

  const pipeGeo1 = new THREE.CylinderGeometry(0.4, 0.4, 3, 12);
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x555566, roughness: 0.3, metalness: 0.7 });
  [
    [-2, 1, -1.5], [2, 1, -1.5],
    [-2, 3, -1.5], [2, 3, -1.5]
  ].forEach(([x, y, z]) => {
    const pipe = new THREE.Mesh(pipeGeo1, pipeMat);
    pipe.position.set(x, y, z);
    room.add(pipe);
  });

  room.position.set(0, 0, 0);
  scene.add(room);
}

function createParticleSystems(scene, obj) {
  const flowCount = 200;
  const flowGeo = new THREE.BufferGeometry();
  const flowPositions = new Float32Array(flowCount * 3);
  const flowColors = new Float32Array(flowCount * 3);
  for (let i = 0; i < flowCount; i++) {
    const gateX = [-5, 0, 5][i % 3];
    flowPositions[i * 3] = gateX + (Math.random() - 0.5) * 1.5;
    flowPositions[i * 3 + 1] = 1 + Math.random() * 2;
    flowPositions[i * 3 + 2] = 0.2 + Math.random() * 2;
    flowColors[i * 3] = 0.4;
    flowColors[i * 3 + 1] = 0.7;
    flowColors[i * 3 + 2] = 1.0;
  }
  flowGeo.setAttribute('position', new THREE.BufferAttribute(flowPositions, 3));
  flowGeo.setAttribute('color', new THREE.BufferAttribute(flowColors, 3));
  const flowMat = new THREE.PointsMaterial({
    size: 0.15,
    vertexColors: true,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  obj.waterFlowParticles = new THREE.Points(flowGeo, flowMat);
  scene.add(obj.waterFlowParticles);

  const mistCount = 300;
  const mistGeo = new THREE.BufferGeometry();
  const mistPositions = new Float32Array(mistCount * 3);
  const mistVelocities = new Float32Array(mistCount * 3);
  for (let i = 0; i < mistCount; i++) {
    const side = i < mistCount / 2 ? -8 : 8;
    mistPositions[i * 3] = side + (Math.random() - 0.5) * 2;
    mistPositions[i * 3 + 1] = 0.5 + Math.random() * 3;
    mistPositions[i * 3 + 2] = 0.5 + Math.random() * 5;
    mistVelocities[i * 3] = (Math.random() - 0.5) * 0.5;
    mistVelocities[i * 3 + 1] = 0.5 + Math.random() * 1.5;
    mistVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
  }
  mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPositions, 3));
  const mistMat = new THREE.PointsMaterial({
    size: 0.3,
    color: 0xccddff,
    transparent: true,
    opacity: 0,
    blending: THREE.NormalBlending,
    depthWrite: false
  });
  obj.mistParticles = new THREE.Points(mistGeo, mistMat);
  obj.mistParticles.userData = { velocities: mistVelocities, count: mistCount };
  scene.add(obj.mistParticles);

  const rainCount = 800;
  const rainGeo = new THREE.BufferGeometry();
  const rainPositions = new Float32Array(rainCount * 3);
  const rainVelocities = new Float32Array(rainCount * 3);
  for (let i = 0; i < rainCount; i++) {
    rainPositions[i * 3] = (Math.random() - 0.5) * 50;
    rainPositions[i * 3 + 1] = 2 + Math.random() * 25;
    rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 40;
    rainVelocities[i * 3] = 0;
    rainVelocities[i * 3 + 1] = -8 - Math.random() * 12;
    rainVelocities[i * 3 + 2] = -1 - Math.random() * 2;
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rainMat = new THREE.PointsMaterial({
    size: 0.08,
    color: 0xaaccff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  obj.rainMesh = new THREE.Points(rainGeo, rainMat);
  obj.rainMesh.userData = { velocities: rainVelocities, count: rainCount };
  scene.add(obj.rainMesh);
}

function createDecorations(scene) {
  const treeTrunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 2, 8);
  const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.8 });
  const treeLeavesGeo = new THREE.ConeGeometry(1.2, 3, 8);
  const treeLeavesMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 0.7 });

  for (let i = 0; i < 30; i++) {
    const treeGroup = new THREE.Group();
    const trunk = new THREE.Mesh(treeTrunkGeo, treeTrunkMat);
    trunk.position.y = 1;
    trunk.castShadow = true;
    treeGroup.add(trunk);
    const leaves = new THREE.Mesh(treeLeavesGeo, treeLeavesMat);
    leaves.position.y = 3;
    leaves.castShadow = true;
    treeGroup.add(leaves);
    const angle = Math.random() * Math.PI * 2;
    const dist = 18 + Math.random() * 35;
    treeGroup.position.set(Math.cos(angle) * dist, 0, -15 - Math.random() * 25);
    treeGroup.scale.setScalar(0.7 + Math.random() * 0.8);
    scene.add(treeGroup);
  }

  const powerLinePoleGeo = new THREE.CylinderGeometry(0.15, 0.2, 6, 8);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.4, metalness: 0.6 });
  for (let z = 5; z <= 18; z += 4) {
    const pole1 = new THREE.Mesh(powerLinePoleGeo, poleMat);
    pole1.position.set(-5, 3, z);
    pole1.castShadow = true;
    scene.add(pole1);
    const pole2 = new THREE.Mesh(powerLinePoleGeo, poleMat);
    pole2.position.set(5, 3, z);
    pole2.castShadow = true;
    scene.add(pole2);
    const wireGeo = new THREE.CylinderGeometry(0.03, 0.03, 11, 6);
    const wire = new THREE.Mesh(wireGeo, new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.8 }));
    wire.rotation.z = Math.PI / 2;
    wire.position.set(0, 5.8, z);
    scene.add(wire);
  }
}

export function updateScene(sceneObjects, state, dt, isInternalView) {
  updateWaterLevel(sceneObjects, state);
  updateTurbineRotation(sceneObjects, state);
  updateSpillway(sceneObjects, state, dt);
  updateRain(sceneObjects, state, dt);
  updateMist(sceneObjects, state, dt);
  updateWaterFlow(sceneObjects, state, dt);
  updateGeneratorVisual(sceneObjects, state);
  updateInternalRoom(sceneObjects, isInternalView);
}

function updateWaterLevel(obj, state) {
  if (!obj.waterPlane) return;
  const targetY = state.waterLevel;
  obj.waterPlane.position.y += (targetY - obj.waterPlane.position.y) * 0.05;

  const positions = obj.waterPlane.geometry.attributes.position;
  const time = performance.now() * 0.001;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getY(i);
    const wave = Math.sin(x * 0.5 + time * 1.5) * Math.cos(z * 0.4 + time) * 0.15 +
      Math.sin(x * 1.2 - time * 2) * Math.sin(z * 0.8 + time * 1.3) * 0.1;
    positions.setZ(i, wave);
  }
  positions.needsUpdate = true;

  const waterColor = state.isOverheating
    ? new THREE.Color(0x3a8a50)
    : new THREE.Color(0x1a6bb0);
  obj.waterPlane.material.color.copy(waterColor);
}

function updateTurbineRotation(obj, state) {
  if (!obj.turbineBlades) return;
  const rps = state.turbineSpeed / 60;
  obj.turbineBlades.rotation.x += rps * Math.PI * 2 * 0.016;
}

function updateSpillway(obj, state, dt) {
  if (!obj.spillwayLeftGate) return;

  if (state.spillwayOpen) {
    obj.spillwayLeftGate.position.y += (7.8 - obj.spillwayLeftGate.position.y) * 0.08;
    obj.spillwayRightGate.position.y += (7.8 - obj.spillwayRightGate.position.y) * 0.08;
    obj.spillwayLeftWater.visible = true;
    obj.spillwayRightWater.visible = true;
    obj.spillwayLeftWater.material.opacity = Math.min(0.7, state.spillwayFlow / 80);
    obj.spillwayRightWater.material.opacity = Math.min(0.7, state.spillwayFlow / 80);
  } else {
    obj.spillwayLeftGate.position.y += (9.8 - obj.spillwayLeftGate.position.y) * 0.08;
    obj.spillwayRightGate.position.y += (9.8 - obj.spillwayRightGate.position.y) * 0.08;
    obj.spillwayLeftWater.visible = false;
    obj.spillwayRightWater.visible = false;
  }
}

function updateRain(obj, state, dt) {
  if (!obj.rainMesh) return;

  const isRaining = state.weather === 'rain';
  const targetOpacity = isRaining ? 0.5 : 0;
  obj.rainMesh.material.opacity += (targetOpacity - obj.rainMesh.material.opacity) * 0.05;

  if (!isRaining && obj.rainMesh.material.opacity < 0.01) return;

  const positions = obj.rainMesh.geometry.attributes.position;
  const velocities = obj.rainMesh.userData.velocities;
  const count = obj.rainMesh.userData.count;

  for (let i = 0; i < count; i++) {
    let y = positions.getY(i) + velocities[i * 3 + 1] * dt;
    let x = positions.getX(i) + velocities[i * 3] * dt;
    let z = positions.getZ(i) + velocities[i * 3 + 2] * dt;

    if (y < 0) {
      y = 22 + Math.random() * 5;
      x = (Math.random() - 0.5) * 50;
      z = (Math.random() - 0.5) * 40;
    }

    positions.setXYZ(i, x, y, z);
  }
  positions.needsUpdate = true;
}

function updateMist(obj, state, dt) {
  if (!obj.mistParticles) return;

  const targetOpacity = state.spillwayOpen ? 0.5 : 0;
  obj.mistParticles.material.opacity += (targetOpacity - obj.mistParticles.material.opacity) * 0.08;

  if (!state.spillwayOpen && obj.mistParticles.material.opacity < 0.01) return;

  const positions = obj.mistParticles.geometry.attributes.position;
  const velocities = obj.mistParticles.userData.velocities;
  const count = obj.mistParticles.userData.count;

  for (let i = 0; i < count; i++) {
    let y = positions.getY(i) + velocities[i * 3 + 1] * dt;
    let x = positions.getX(i) + velocities[i * 3] * dt;
    let z = positions.getZ(i) + velocities[i * 3 + 2] * dt;

    if (y > 8) {
      const side = i < count / 2 ? -8 : 8;
      y = 0.3;
      x = side + (Math.random() - 0.5) * 2;
      z = 0.5 + Math.random() * 5;
    }

    positions.setXYZ(i, x, y, z);
  }
  positions.needsUpdate = true;
}

function updateWaterFlow(obj, state, dt) {
  if (!obj.waterFlowParticles) return;

  const positions = obj.waterFlowParticles.geometry.attributes.position;
  const count = positions.count;
  const gateFlow = state.flowRate;
  obj.waterFlowParticles.material.opacity = 0.2 + (gateFlow / 100) * 0.6;

  for (let i = 0; i < count; i++) {
    let z = positions.getZ(i) + (2 + gateFlow * 0.05) * dt;
    const gateX = [-5, 0, 5][i % 3];
    let x = positions.getX(i);
    let y = positions.getY(i);

    if (z > 3) {
      z = 0.2 + Math.random() * 0.3;
      x = gateX + (Math.random() - 0.5) * 1.5;
      y = 1 + Math.random() * 2;
    }

    positions.setXYZ(i, x, y, z);
  }
  positions.needsUpdate = true;
}

function updateGeneratorVisual(obj, state) {
  if (!obj.generatorBody) return;

  if (state.isOverheating) {
    obj.generatorBody.material.color.set(0xdd5533);
    obj.generatorBody.material.emissive = new THREE.Color(0x441100);
    obj.generatorBody.material.emissiveIntensity = 0.6;
    obj.generatorGlow.material.opacity = 0.5 + Math.sin(performance.now() * 0.01) * 0.3;
    obj.generatorGlow.scale.setScalar(1 + Math.sin(performance.now() * 0.008) * 0.3);
  } else if (state.cooling) {
    obj.generatorBody.material.color.lerp(new THREE.Color(0x5588aa), 0.1);
    obj.generatorBody.material.emissiveIntensity = 0.2;
    obj.generatorGlow.material.opacity = 0.1;
    obj.generatorGlow.scale.setScalar(1);
  } else {
    obj.generatorBody.material.color.lerp(new THREE.Color(0x5588aa), 0.05);
    obj.generatorBody.material.emissiveIntensity = 0.3;
    obj.generatorGlow.material.opacity = 0;
    obj.generatorGlow.scale.setScalar(1);
  }
}

function updateInternalRoom(obj, isInternalView) {
  obj.internalRoom.visible = isInternalView;

  if (obj.damMainBody) {
    if (isInternalView) {
      obj.damMainBody.material.transparent = true;
      obj.damMainBody.material.opacity = 0.2;
      obj.damMainBody.material.depthWrite = false;
    } else {
      obj.damMainBody.material.transparent = false;
      obj.damMainBody.material.opacity = 1;
      obj.damMainBody.material.depthWrite = true;
    }
    obj.damMainBody.material.needsUpdate = true;
  }
}

export function setSkyColor(scene, weather, isNight) {
  if (weather === 'rain') {
    scene.background = new THREE.Color(0x556677);
    scene.fog = new THREE.Fog(0x556677, 15, 80);
  } else {
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 20, 120);
  }
}