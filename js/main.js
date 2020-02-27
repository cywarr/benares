import * as THREE from 'https://threejs.org/build/three.module.js';
import { OrbitControls } from 'https://threejs.org/examples/jsm/controls/OrbitControls.js';

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 1, 1000);
camera.position.set(1, 2, 3).setLength(4);
var renderer = new THREE.WebGLRenderer({
    antialias: true
});
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x884400);
document.body.appendChild(renderer.domElement);

var controls = new OrbitControls(camera, renderer.domElement);

var path = "https://threejs.org/examples/textures/cube/SwedishRoyalCastle/";
var format = '.jpg';
var urls = [
    path + 'px' + format, path + 'nx' + format,
    path + 'py' + format, path + 'ny' + format,
    path + 'pz' + format, path + 'nz' + format
];

var cubeTextureLoader = new THREE.CubeTextureLoader();

var reflectionCube = cubeTextureLoader.load(urls);

/*var light = new THREE.DirectionalLight(0xffffff, 0.125);
light.position.set(0, 1, 0);
scene.add(light);*/
scene.add(new THREE.AmbientLight(0xffffff, 1));

//scene.add(new THREE.GridHelper(10, 10));

var spheresAmount = 10;
var angleStep = Math.PI / spheresAmount;

var spheres = [];
var corpuscules = [];

var sphereColor = 0x224488;
var sGeom = new THREE.SphereBufferGeometry(0.05, 16, 16);
var sMat = new THREE.MeshStandardMaterial({
    color: sphereColor,
    envMap: reflectionCube,
    roughness: 0.99,
    metalness: 0.99
});
for (let i = 0; i < spheresAmount; i++) {
    let sphere = new THREE.Mesh(sGeom, sMat);
    sphere.userData.dirVector = new THREE.Vector3().setFromSphericalCoords(
        1,
        //(Math.random() - 0.5) < 0 ? (Math.random() * Math.PI * 0.25) : Math.PI - (Math.random() * Math.PI * 0.25), 
        Math.random() * Math.PI, 
        Math.random() * Math.PI * 2);
    sphere.userData.dirTheta = i * angleStep;
    spheres.push(sphere);
    scene.add(sphere);
    corpuscules.push(sphere.position);
}

//var mainSphereGeom = new THREE.SphereBufferGeometry(1.25, 144, 144).toNonIndexed();
var mainSphereGeom = new THREE.BoxBufferGeometry(2, 2, 2, 50, 50, 50);
// make a sphere from the box
var sPos = mainSphereGeom.attributes.position;
var sNorm = mainSphereGeom.attributes.normal;
var temp = new THREE.Vector3();
for (let i = 0; i < sPos.count; i++){

    temp.fromBufferAttribute(sPos, i);
    temp.normalize();

    sPos.setXYZ(i, temp.x, temp.y, temp.z);
    sNorm.setXYZ(i, temp.x, temp.y, temp.z);
}
mainSphereGeom = mainSphereGeom.toNonIndexed();
//console.log(mainSphereGeom, mainSphereGeom.attributes.position.count);

// vertices of a face before and after
var vertAfter = [];
var vecAfter = new THREE.Vector3();
var vertBefore = [];
var vecBefore = new THREE.Vector3();

var pos = mainSphereGeom.attributes.position;
for (let i = 0; i < pos.count; i++) {
    let face = Math.floor(i / 3);

    let afterIdx = (i % 3) + 1;
    afterIdx = afterIdx > 2 ? 0 : afterIdx;
    vecAfter.fromBufferAttribute(pos, (face * 3) + afterIdx);
    vertAfter.push(vecAfter.x, vecAfter.y, vecAfter.z);

    let beforeIdx = (i % 3) - 1;
    beforeIdx = beforeIdx < 0 ? 2 : beforeIdx;
    vecBefore.fromBufferAttribute(pos, (face * 3) + beforeIdx);
    vertBefore.push(vecBefore.x, vecBefore.y, vecBefore.z)
}
mainSphereGeom.setAttribute("vertAfter", new THREE.Float32BufferAttribute(vertAfter, 3));
mainSphereGeom.setAttribute("vertBefore", new THREE.Float32BufferAttribute(vertBefore, 3));

//scene.background = reflectionCube;

var mainSphereMat = new THREE.MeshStandardMaterial({
    color: sphereColor,
    envMap: reflectionCube,
    envMapIntensity: 0.125,
    metalness: 0.75,
    roughness: 0,
    wireframe: false
});
//mainSphereMat.defines = {"USE_ENVMAP":""};
var uniforms = {
    corpuscules: {
        value: corpuscules
    }
};
mainSphereMat.onBeforeCompile = shader => {
    shader.uniforms.corpuscules = uniforms.corpuscules;
    console.log(shader.vertexShader);
    //console.log(shader.fragmentShader);
    shader.vertexShader = `
  	uniform vec3 corpuscules[${spheresAmount}];
    attribute vec3 vertAfter;
    attribute vec3 vertBefore;

    vec3 getShiftedPoint(vec3 p){
      vec3 accumulate = vec3(0);

      for(int i = 0; i < ${spheresAmount}; i++){
        vec3 sPos = corpuscules[i];
        vec3 diff = sPos - p;
        vec3 dir = normalize(diff);
        float dist = length(diff);

        float force = .0125 / pow(dist, 1.);
        vec3 forceVec = dir * clamp(force, 0., dist);

        accumulate += forceVec;
      }
      return p + accumulate;
    }
  ` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
        `#include <begin_vertex>`,
        `#include <begin_vertex>
 
    transformed = getShiftedPoint(transformed);

    vec3 pointAfter = getShiftedPoint(vertAfter);
    vec3 pointBefore = getShiftedPoint(vertBefore);

    vec3 cb = normalize(pointAfter - transformed);
    vec3 ab = normalize(pointBefore - transformed);
    transformedNormal = cross(cb, ab);
    `
    );
}
var mainSphere = new THREE.Mesh(mainSphereGeom, mainSphereMat);
scene.add(mainSphere);

window.addEventListener('resize', onWindowResize, false);

var clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
    let t = clock.getElapsedTime() * 0.75;
    spheres.forEach((s, idx) => {

        s.position.copy(s.userData.dirVector).multiplyScalar(Math.sin(s.userData.dirTheta + t) * 2);

    });
    renderer.render(scene, camera)
});

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);

}
