<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import * as THREE from 'three'
  import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
  import { mapStore, isSimulatingStore } from '../stores/mapStore'
  import type { MetroMapData, MetroLine, Station, Scene3DConfig, ViewMode3D } from '../types'
  import { DEFAULT_SCENE_3D_CONFIG } from '../types'
  import { stationTo3D, getLinePoints3D, createSmoothCurve3D, getPointOnCurve3D } from '../utils/scene3d'
  import {
    buildTunnelMesh,
    buildStationMesh,
    buildTrainMesh,
    buildGroundPlane,
    buildCityBuildings,
    buildGridHelper,
    setTrainDoors,
    getTrainsPerLine
  } from '../utils/meshBuilder'

  export let config: Scene3DConfig = { ...DEFAULT_SCENE_3D_CONFIG }

  let container: HTMLDivElement
  let renderer: THREE.WebGLRenderer
  let scene: THREE.Scene
  let camera: THREE.PerspectiveCamera
  let controls: OrbitControls
  let animationId: number
  let mapData: MetroMapData | null = null
  let isSimulating = false

  const tunnelGroup = new THREE.Group()
  const stationGroup = new THREE.Group()
  const trainGroup = new THREE.Group()
  const environmentGroup = new THREE.Group()

  const trainCurves = new Map<string, THREE.CatmullRomCurve3>()
  const trainData = new Map<string, { mesh: THREE.Group; progress: number; state: 'moving' | 'stopped'; stopTimer: number }[]>()

  let selectedStationId: string | null = null
  let raycaster = new THREE.Raycaster()
  let mouse = new THREE.Vector2()
  let dragTarget: THREE.Object3D | null = null
  let isDragging = false
  let dragPlane = new THREE.Plane()
  let dragOffset = new THREE.Vector3()

  let ambientLight: THREE.AmbientLight
  let directionalLight: THREE.DirectionalLight

  let lastConfig: Scene3DConfig
  let currentViewMode: ViewMode3D | null = null
  let firstPersonLineId: string | null = null
  let firstPersonSmoothPos = new THREE.Vector3()
  let firstPersonSmoothLook = new THREE.Vector3()
  let isFirstPersonInitialized = false

  const LOD_HIGH_DISTANCE = 25
  const LOD_MEDIUM_DISTANCE = 50
  const STATION_STOP_DURATION = 2.5
  const FP_CAMERA_HEIGHT = 2.8
  const FP_CAMERA_FORWARD = 0.3
  const FP_SMOOTHING = 0.15

  const unsubscribeMap = mapStore.subscribe(data => {
    mapData = data
    if (scene) rebuildScene()
  })

  const unsubscribeSim = isSimulatingStore.subscribe(v => {
    isSimulating = v
  })

  function initScene() {
    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0f1020)
    scene.fog = new THREE.FogExp2(0x0f1020, 0.004)

    camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      2000
    )
    camera.position.set(0, 50, 50)
    camera.lookAt(0, 0, 0)

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    container.appendChild(renderer.domElement)

    controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 5
    controls.maxDistance = 500
    controls.maxPolarAngle = Math.PI * 0.85

    ambientLight = new THREE.AmbientLight(0xffffff, config.ambientLightIntensity)
    scene.add(ambientLight)

    directionalLight = new THREE.DirectionalLight(0xffffff, config.directionalLightIntensity)
    directionalLight.position.set(40, 70, 40)
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 2048
    directionalLight.shadow.mapSize.height = 2048
    directionalLight.shadow.camera.near = 0.5
    directionalLight.shadow.camera.far = 500
    directionalLight.shadow.camera.left = -100
    directionalLight.shadow.camera.right = 100
    directionalLight.shadow.camera.top = 100
    directionalLight.shadow.camera.bottom = -100
    scene.add(directionalLight)

    const hemiLight = new THREE.HemisphereLight(0x6688cc, 0x221a0a, 0.4)
    scene.add(hemiLight)

    scene.add(tunnelGroup)
    scene.add(stationGroup)
    scene.add(trainGroup)
    scene.add(environmentGroup)

    renderer.domElement.addEventListener('click', onMouseClick)
    renderer.domElement.addEventListener('mousedown', onMouseDown)
    renderer.domElement.addEventListener('mousemove', onMouseMove)
    renderer.domElement.addEventListener('mouseup', onMouseUp)
    window.addEventListener('resize', onResize)
  }

  function rebuildScene() {
    if (!mapData) return

    clearGroup(tunnelGroup)
    clearGroup(stationGroup)
    clearGroup(trainGroup)
    clearGroup(environmentGroup)
    trainCurves.clear()
    trainData.clear()
    isFirstPersonInitialized = false

    if (config.showGround) {
      environmentGroup.add(buildGroundPlane(mapData))
      environmentGroup.add(buildGridHelper())
    }

    if (config.showBuildings) {
      environmentGroup.add(buildCityBuildings(mapData))
    }

    for (const line of mapData.lines) {
      if (config.showTunnels) {
        const tunnel = buildTunnelMesh(line, mapData, config.tunnelOpacity)
        if (tunnel) tunnelGroup.add(tunnel)
      }

      const points = getLinePoints3D(line, mapData)
      if (points.length >= 2) {
        const curve = createSmoothCurve3D(points)
        trainCurves.set(line.id, curve)

        if (config.showTrains) {
          const trainsPerLine = getTrainsPerLine()
          const trainList: { mesh: THREE.Group; progress: number; state: 'moving' | 'stopped'; stopTimer: number }[] = []

          for (let i = 0; i < trainsPerLine; i++) {
            const train = buildTrainMesh(line)
            trainGroup.add(train)

            const progress = i / trainsPerLine
            const { position, tangent } = getPointOnCurve3D(curve, progress)
            train.position.copy(position)
            const lookAt = position.clone().add(tangent)
            train.lookAt(lookAt)

            trainList.push({
              mesh: train,
              progress,
              state: 'moving',
              stopTimer: 0
            })
          }
          trainData.set(line.id, trainList)
        }
      }
    }

    for (const station of mapData.stations) {
      const stationMesh = buildStationMesh(station, mapData.lines, 'high')
      stationGroup.add(stationMesh)
    }

    if (!firstPersonLineId && mapData.lines.length > 0) {
      firstPersonLineId = mapData.lines[0].id
      config.firstPersonLineId = firstPersonLineId
    }
  }

  function clearGroup(group: THREE.Group) {
    while (group.children.length > 0) {
      const child = group.children[0]
      group.remove(child)
      disposeObject(child)
    }
  }

  function disposeObject(obj: THREE.Object3D) {
    if (obj instanceof THREE.Mesh) {
      obj.geometry?.dispose()
      if (Array.isArray(obj.material)) {
        obj.material.forEach(m => m.dispose())
      } else {
        obj.material?.dispose()
      }
    } else if (obj instanceof THREE.InstancedMesh) {
      obj.geometry?.dispose()
      if (Array.isArray(obj.material)) {
        obj.material.forEach(m => m.dispose())
      } else {
        obj.material?.dispose()
      }
    } else if (obj instanceof THREE.Group) {
      while (obj.children.length > 0) {
        const child = obj.children[0]
        obj.remove(child)
        disposeObject(child)
      }
    } else if (obj instanceof THREE.Sprite) {
      obj.material?.dispose()
    }
  }

  function updateTrains(delta: number) {
    if (!isSimulating || !config.showTrains || !mapData) return

    for (const [lineId, curve] of trainCurves) {
      const trains = trainData.get(lineId)
      if (!trains) continue

      const line = mapData.lines.find(l => l.id === lineId)
      if (!line) continue

      const stationCount = line.stationIds.length
      if (stationCount < 2) continue

      const stationProgresses: number[] = []
      for (let i = 0; i < stationCount; i++) {
        stationProgresses.push(i / (stationCount - 1))
      }

      const speed = 0.03 * config.trainSpeed

      for (const train of trains) {
        if (train.state === 'stopped') {
          train.stopTimer -= delta
          const doorProgress = Math.min(1, Math.max(0, 1 - Math.abs(train.stopTimer - STATION_STOP_DURATION / 2) / (STATION_STOP_DURATION / 2)))
          setTrainDoors(train.mesh, doorProgress * 0.7)

          if (train.stopTimer <= 0) {
            train.state = 'moving'
          }
        } else {
          train.progress = (train.progress + delta * speed) % 1

          const { position, tangent } = getPointOnCurve3D(curve, train.progress)
          train.mesh.position.copy(position)
          const lookAt = position.clone().add(tangent)
          train.mesh.lookAt(lookAt)

          setTrainDoors(train.mesh, 0)

          for (const sp of stationProgresses) {
            const dist = Math.abs(train.progress - sp)
            if (dist < speed * delta * 0.8 && train.progress > sp) {
              train.state = 'stopped'
              train.stopTimer = STATION_STOP_DURATION
              train.progress = sp
              break
            }
          }
        }
      }
    }
  }

  function updateFirstPersonCamera(delta: number) {
    if (currentViewMode !== 'firstperson' || !config.firstPersonFollowTrain) {
      return
    }

    const lineId = firstPersonLineId || config.firstPersonLineId
    if (!lineId) return

    const trains = trainData.get(lineId)
    if (!trains || trains.length === 0) return

    const primaryTrain = trains[0]
    const trainMesh = primaryTrain.mesh

    const trainPos = trainMesh.position.clone()
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(trainMesh.quaternion)

    const targetPos = new THREE.Vector3()
      .copy(trainPos)
      .add(forward.clone().multiplyScalar(FP_CAMERA_FORWARD))
      .add(new THREE.Vector3(0, FP_CAMERA_HEIGHT, 0))

    const targetLook = new THREE.Vector3()
      .copy(trainPos)
      .add(forward.clone().multiplyScalar(30))
      .add(new THREE.Vector3(0, FP_CAMERA_HEIGHT - 0.5, 0))

    if (!isFirstPersonInitialized) {
      firstPersonSmoothPos.copy(targetPos)
      firstPersonSmoothLook.copy(targetLook)
      isFirstPersonInitialized = true
    }

    const smoothing = Math.min(1, FP_SMOOTHING * delta * 60)
    firstPersonSmoothPos.lerp(targetPos, smoothing)
    firstPersonSmoothLook.lerp(targetLook, smoothing)

    controls.enabled = false
    camera.position.copy(firstPersonSmoothPos)
    camera.lookAt(firstPersonSmoothLook)
    controls.target.copy(firstPersonSmoothLook)
  }

  function updateLOD() {
    if (!camera || !mapData || currentViewMode === 'firstperson') return

    const cameraPos = camera.position

    for (const stationObj of stationGroup.children) {
      if (stationObj.userData.type !== 'station-group') continue

      const distance = cameraPos.distanceTo(stationObj.position)
      const currentLevel = stationObj.userData.lodLevel || 'high'

      let targetLevel: 'low' | 'medium' | 'high' = 'high'
      if (distance > LOD_MEDIUM_DISTANCE) {
        targetLevel = 'low'
      } else if (distance > LOD_HIGH_DISTANCE) {
        targetLevel = 'medium'
      }

      if (targetLevel !== currentLevel) {
        const stationId = stationObj.userData.stationId
        const station = mapData.stations.find(s => s.id === stationId)
        if (!station) continue

        const newGroup = buildStationMesh(station, mapData.lines, targetLevel)
        newGroup.position.copy(stationObj.position)

        const index = stationGroup.children.indexOf(stationObj)
        if (index >= 0) {
          stationGroup.children[index] = newGroup
          disposeObject(stationObj)
        }
      }
    }
  }

  function updateLighting() {
    if (ambientLight) {
      ambientLight.intensity = config.ambientLightIntensity
    }
    if (directionalLight) {
      directionalLight.intensity = config.directionalLightIntensity
    }
  }

  function onMouseClick(event: MouseEvent) {
    if (isDragging || currentViewMode === 'firstperson') return
    const rect = renderer.domElement.getBoundingClientRect()
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    raycaster.setFromCamera(mouse, camera)
    const intersects = raycaster.intersectObjects(stationGroup.children, true)

    if (intersects.length > 0) {
      let obj: THREE.Object3D | null = intersects[0].object
      while (obj && !obj.userData.stationId) {
        obj = obj.parent
      }
      if (obj?.userData.stationId) {
        selectedStationId = obj.userData.stationId
        return
      }
    }
    selectedStationId = null
  }

  function onMouseDown(event: MouseEvent) {
    if (event.button !== 0 || currentViewMode === 'firstperson') return
    const rect = renderer.domElement.getBoundingClientRect()
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    raycaster.setFromCamera(mouse, camera)
    const intersects = raycaster.intersectObjects(stationGroup.children, true)

    if (intersects.length > 0) {
      let obj: THREE.Object3D | null = intersects[0].object
      while (obj && obj.userData.type !== 'station-group') {
        obj = obj.parent
      }
      if (obj) {
        dragTarget = obj
        isDragging = false
        const normal = new THREE.Vector3(0, 1, 0)
        dragPlane.setFromNormalAndCoplanarPoint(normal, obj.position)
        const intersection = new THREE.Vector3()
        raycaster.ray.intersectPlane(dragPlane, intersection)
        if (intersection) {
          dragOffset.copy(obj.position).sub(intersection)
        }
        controls.enabled = false
      }
    }
  }

  function onMouseMove(event: MouseEvent) {
    if (!dragTarget || currentViewMode === 'firstperson') return
    isDragging = true

    const rect = renderer.domElement.getBoundingClientRect()
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    raycaster.setFromCamera(mouse, camera)
    const intersection = new THREE.Vector3()
    raycaster.ray.intersectPlane(dragPlane, intersection)
    if (intersection) {
      const newPos = intersection.add(dragOffset)
      dragTarget.position.y = newPos.y
    }
  }

  function onMouseUp() {
    if (dragTarget && isDragging && mapData) {
      const stationId = dragTarget.userData.stationId
      if (stationId) {
        const newDepth = -dragTarget.position.y / 0.1
        mapStore.updateStation(stationId, { depth: newDepth })
      }
    }
    dragTarget = null
    isDragging = false
    if (currentViewMode !== 'firstperson') {
      controls.enabled = true
    }
  }

  function onResize() {
    if (!container || !camera || !renderer) return
    camera.aspect = container.clientWidth / container.clientHeight
    camera.updateProjectionMatrix()
    renderer.setSize(container.clientWidth, container.clientHeight)
  }

  let lastTime = 0
  let lodTimer = 0

  function animate(time: number) {
    animationId = requestAnimationFrame(animate)
    const delta = Math.min((time - lastTime) / 1000, 0.1)
    lastTime = time

    updateTrains(delta)
    updateFirstPersonCamera(delta)

    if (currentViewMode !== 'firstperson') {
      controls.update()
    }

    lodTimer += delta
    if (lodTimer > 0.2) {
      updateLOD()
      lodTimer = 0
    }

    renderer.render(scene, camera)
  }

  export function setCameraPreset(mode: ViewMode3D) {
    if (!mapData || !camera || !controls) return

    currentViewMode = mode
    isFirstPersonInitialized = false

    if (mode !== 'firstperson') {
      controls.enabled = true
    }

    const center = new THREE.Vector3()
    let count = 0
    for (const s of mapData.stations) {
      center.add(stationTo3D(s, mapData.lines))
      count++
    }
    if (count > 0) center.divideScalar(count)

    let targetPos: THREE.Vector3
    let targetLook: THREE.Vector3

    switch (mode) {
      case 'topdown':
        targetPos = new THREE.Vector3(center.x, 100, center.z + 0.01)
        targetLook = center.clone()
        break
      case 'side':
        targetPos = new THREE.Vector3(center.x - 55, center.y - 1, center.z)
        targetLook = new THREE.Vector3(center.x, center.y - 2, center.z)
        break
      case 'panorama':
        targetPos = new THREE.Vector3(center.x + 45, 35, center.z + 45)
        targetLook = new THREE.Vector3(center.x, -4, center.z)
        break
      case 'firstperson': {
        const lineId = firstPersonLineId || config.firstPersonLineId
        const line = lineId ? mapData.lines.find(l => l.id === lineId) : null

        if (line && line.stationIds.length >= 2) {
          const firstStationId = line.stationIds[0]
          const firstStation = mapData.stations.find(s => s.id === firstStationId)
          if (firstStation) {
            const pos = stationTo3D(firstStation, mapData.lines)
            const curve = trainCurves.get(line.id)
            if (curve) {
              const tangent = curve.getTangentAt(0)
              targetPos = new THREE.Vector3(pos.x, pos.y + FP_CAMERA_HEIGHT, pos.z)
              targetLook = new THREE.Vector3().copy(pos).add(tangent.multiplyScalar(30))
              targetLook.y = pos.y + FP_CAMERA_HEIGHT - 0.5
            } else {
              targetPos = new THREE.Vector3(pos.x, pos.y + FP_CAMERA_HEIGHT, pos.z)
              targetLook = new THREE.Vector3(pos.x + 30, pos.y + FP_CAMERA_HEIGHT - 0.5, pos.z)
            }
          } else {
            targetPos = new THREE.Vector3(center.x, center.y + FP_CAMERA_HEIGHT, center.z)
            targetLook = new THREE.Vector3(center.x + 30, center.y + FP_CAMERA_HEIGHT - 0.5, center.z)
          }
        } else {
          const firstStation = mapData.stations.find(s => s.isTransfer) || mapData.stations[0]
          if (firstStation) {
            const pos = stationTo3D(firstStation, mapData.lines)
            targetPos = new THREE.Vector3(pos.x, pos.y + FP_CAMERA_HEIGHT, pos.z)
            targetLook = new THREE.Vector3(pos.x - 30, pos.y + FP_CAMERA_HEIGHT - 0.5, pos.z)
          } else {
            targetPos = new THREE.Vector3(center.x, center.y + FP_CAMERA_HEIGHT, center.z)
            targetLook = center.clone()
          }
        }
        break
      }
    }

    if (mode === 'firstperson' && config.firstPersonFollowTrain) {
      firstPersonSmoothPos.copy(targetPos!)
      firstPersonSmoothLook.copy(targetLook!)
      camera.position.copy(targetPos!)
      camera.lookAt(targetLook!)
      controls.target.copy(targetLook!)
    } else {
      animateCamera(targetPos!, targetLook!)
    }
  }

  export function setFirstPersonLine(lineId: string | null) {
    firstPersonLineId = lineId
    config.firstPersonLineId = lineId
    isFirstPersonInitialized = false

    if (currentViewMode === 'firstperson' && lineId && mapData) {
      const line = mapData.lines.find(l => l.id === lineId)
      if (line && line.stationIds.length >= 2) {
        const firstStationId = line.stationIds[0]
        const firstStation = mapData.stations.find(s => s.id === firstStationId)
        if (firstStation) {
          const pos = stationTo3D(firstStation, mapData.lines)
          const curve = trainCurves.get(line.id)
          const tangent = curve ? curve.getTangentAt(0) : new THREE.Vector3(1, 0, 0)
          const targetPos = new THREE.Vector3(pos.x, pos.y + FP_CAMERA_HEIGHT, pos.z)
          const targetLook = new THREE.Vector3().copy(pos).add(tangent.multiplyScalar(30))
          targetLook.y = pos.y + FP_CAMERA_HEIGHT - 0.5

          firstPersonSmoothPos.copy(targetPos)
          firstPersonSmoothLook.copy(targetLook)
          camera.position.copy(targetPos)
          camera.lookAt(targetLook)
          controls.target.copy(targetLook)
        }
      }
    }
  }

  function animateCamera(targetPosition: THREE.Vector3, targetLookAt: THREE.Vector3) {
    const startPos = camera.position.clone()
    const startTarget = controls.target.clone()
    const duration = 1200
    const startTime = performance.now()

    function step() {
      const elapsed = performance.now() - startTime
      const t = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)

      camera.position.lerpVectors(startPos, targetPosition, eased)
      controls.target.lerpVectors(startTarget, targetLookAt, eased)
      controls.update()

      if (t < 1) {
        requestAnimationFrame(step)
      }
    }
    step()
  }

  export function refreshScene() {
    rebuildScene()
  }

  $: {
    if (scene && config !== lastConfig) {
      updateLighting()

      const tunnelOpacityChanged = lastConfig && config.tunnelOpacity !== lastConfig.tunnelOpacity
      if (tunnelOpacityChanged) {
        for (const child of tunnelGroup.children) {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshPhongMaterial) {
            child.material.opacity = config.tunnelOpacity
          }
        }
      }

      const firstPersonLineChanged = lastConfig && config.firstPersonLineId !== lastConfig.firstPersonLineId
      if (firstPersonLineChanged) {
        setFirstPersonLine(config.firstPersonLineId)
      }

      const showGroundChanged = lastConfig && config.showGround !== lastConfig.showGround
      const showBuildingsChanged = lastConfig && config.showBuildings !== lastConfig.showBuildings
      const showTunnelsChanged = lastConfig && config.showTunnels !== lastConfig.showTunnels
      const showTrainsChanged = lastConfig && config.showTrains !== lastConfig.showTrains

      if (showGroundChanged || showBuildingsChanged || showTunnelsChanged || showTrainsChanged) {
        rebuildScene()
      }

      lastConfig = { ...config }
    }
  }

  onMount(() => {
    lastConfig = { ...config }
    initScene()
    if (mapData) rebuildScene()
    animationId = requestAnimationFrame(animate)
  })

  onDestroy(() => {
    cancelAnimationFrame(animationId)
    unsubscribeMap()
    unsubscribeSim()
    renderer?.domElement.removeEventListener('click', onMouseClick)
    renderer?.domElement.removeEventListener('mousedown', onMouseDown)
    renderer?.domElement.removeEventListener('mousemove', onMouseMove)
    renderer?.domElement.removeEventListener('mouseup', onMouseUp)
    window.removeEventListener('resize', onResize)
    if (renderer) {
      renderer.dispose()
      container?.removeChild(renderer.domElement)
    }
  })
</script>

<div class="scene-3d-container" bind:this={container}>
  {#if currentViewMode === 'firstperson' && config.firstPersonFollowTrain && firstPersonLineId}
    <div class="fp-hud">
      <div class="fp-info">
        {#if mapData}
          {#each mapData.lines.filter(l => l.id === firstPersonLineId) as line}
            <span class="fp-line-dot" style="background: {line.color};"></span>
            <span class="fp-line-name">{line.name}</span>
          {/each}
        {/if}
        <span class="fp-mode-indicator">第一人称视角</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .scene-3d-container {
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
  }

  .scene-3d-container :global(canvas) {
    display: block;
    cursor: grab;
  }

  .scene-3d-container :global(canvas:active) {
    cursor: grabbing;
  }

  .fp-hud {
    position: absolute;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
    pointer-events: none;
  }

  .fp-info {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 16px;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .fp-line-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.8);
  }

  .fp-line-name {
    color: #fff;
    font-size: 14px;
    font-weight: 600;
  }

  .fp-mode-indicator {
    color: rgba(255, 255, 255, 0.6);
    font-size: 12px;
    padding-left: 10px;
    border-left: 1px solid rgba(255, 255, 255, 0.2);
  }
</style>
