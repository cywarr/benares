import * as THREE from 'https://threejs.org/build/three.module.js';
import { OrbitControls } from 'https://threejs.org/examples/jsm/controls/OrbitControls.js';

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0, 3).setLength(4);
var renderer = new THREE.WebGLRenderer({
    antialias: true
});
renderer.setSize(innerWidth, innerHeight);
var backColor = 0xff8844;
renderer.setClearColor(backColor);
document.body.appendChild(renderer.domElement);

var controls = new OrbitControls(camera, renderer.domElement);

var path = "./textures/cube/";
var prefix = ``;//`dark-s_`;
var format = '.jpg';
var urls = [
    path + prefix + 'posx' + format, path + prefix + 'negx' + format,
    path + prefix + 'posy' + format, path + prefix + 'negy' + format,
    path + prefix + 'posz' + format, path + prefix + 'negz' + format
];

var cubeTextureLoader = new THREE.CubeTextureLoader();

var reflectionCube = cubeTextureLoader.load(urls);

//scene.background = reflectionCube;

var light = new THREE.DirectionalLight(0xffffff, 0.125);
light.position.set(0, -1, 0);
scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff, 0.875));

//scene.add(new THREE.GridHelper(10, 10));

var spheresAmount = 12;
var angleStep = Math.PI / spheresAmount;

var spheres = [];
var corpuscules = [];

var sphereColor = 0x222244;
var sGeom = new THREE.SphereBufferGeometry(0.05, 16, 16);
var sMat = new THREE.MeshStandardMaterial({
    color: sphereColor
});

var icosahedronGeom = new THREE.IcosahedronGeometry(1, 0);
for (let i = 0; i < spheresAmount; i++) {
    let sphere = new THREE.Mesh(sGeom, sMat);
    sphere.userData.dirVector = new THREE.Vector3().copy(icosahedronGeom.vertices[i]);//.setFromSphericalCoords(
        //1,
        //(Math.random() - 0.5) < 0 ? (Math.random() * Math.PI * 0.25) : Math.PI - (Math.random() * Math.PI * 0.25), 
        //Math.random() * Math.PI, 
        //Math.random() * Math.PI * 2);
    sphere.userData.dirTheta = Math.random() * Math.PI; //i * angleStep;
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


var mainSphereMat = new THREE.MeshLambertMaterial({
    color: 0x222244,
    envMap: reflectionCube,
    reflectivity: 0.25
    //envMapIntensity: 10,
    //map: new THREE.TextureLoader().load("https://threejs.org/examples/textures/uv_grid_opengl.jpg"),
    //metalness: 1,
    //roughness: 0.25
});
mainSphereMat.defines = {"USE_ENVMAP":""};
var uniforms = {
    corpuscules: {
        value: corpuscules
    }
};
mainSphereMat.onBeforeCompile = shader => {
    shader.uniforms.corpuscules = uniforms.corpuscules;
    shader.vertexShader = `
  	uniform vec3 corpuscules[${spheresAmount}];
  ` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
        `#include <begin_vertex>`,
        `#include <begin_vertex>
    
    vec3 accumulate = vec3(0);
    float shortestDist = 1000.;
    
    for(int i = 0; i < ${spheresAmount}; i++){
    	vec3 sPos = corpuscules[i];
      vec3 diff = sPos - transformed;
      vec3 dir = normalize(diff);
      float dist = length(diff);
      shortestDist = min(shortestDist, dist);
      
      float force = .0125 / (dist * dist);
      vec3 forceVec = dir * force;
      
      accumulate += forceVec;
    }
    
    vec3 normAccumulate = normalize(accumulate);
    
    float accumulateLength = clamp(length(accumulate), 0., shortestDist);
    accumulate = normAccumulate * accumulateLength;

    float distRatio = accumulateLength / shortestDist;

    transformed += accumulate;
   
    // re-compute normals    
    vec3 n0 = vec3(normal);
    vec3 n1 = cross(normAccumulate, n0);
    vec3 n2 = cross(n1, normAccumulate);
    vec3 finalNormal = mix(n0, n2, distRatio);
    transformedNormal = normalMatrix * finalNormal;
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
