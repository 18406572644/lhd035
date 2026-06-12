import * as THREE from 'three'
import type { Station, MetroLine, MetroMapData } from '../types'
import { stationTo3D, getLineDepth, hexToThreeColor, createSmoothCurve3D, getLinePoints3D, drawRoundedRect } from './scene3d'

const TUNNEL_SEGMENTS = 64
const TUNNEL_RADIUS = 1.8
const TUNNEL_RADIAL_SEGMENTS = 16
const STATION_BASE_SIZE = 4
const TRANSFER_STATION_SIZE = 6
const STATION_FLOOR_HEIGHT = 2.5
const TRAIN_LENGTH = 10
const TRAIN_WIDTH = 2.2
const TRAIN_HEIGHT = 2.5
const TRAIN_CARRIAGES = 3
const TRAINS_PER_LINE = 3

export function buildTunnelMesh(
  line: MetroLine,
  mapData: MetroMapData,
  opacity: number
): THREE.Mesh | null {
  const points = getLinePoints3D(line, mapData)
  if (points.length < 2) return null

  const curve = createSmoothCurve3D(points)
  const depth = getLineDepth(line, mapData.lines)
  const radius = line.tunnelRadius ?? TUNNEL_RADIUS

  const geometry = new THREE.TubeGeometry(
    curve,
    TUNNEL_SEGMENTS,
    radius,
    TUNNEL_RADIAL_SEGMENTS,
    false
  )

  const color = hexToThreeColor(line.color)
  const material = new THREE.MeshPhongMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    shininess: 30
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.userData = { type: 'tunnel', lineId: line.id, depth }
  return mesh
}

export function buildStationMesh(
  station: Station,
  lines: MetroLine[],
  lodLevel: 'high' | 'medium' | 'low' = 'high'
): THREE.Group {
  const group = new THREE.Group()
  const position = stationTo3D(station, lines)
  group.position.copy(position)

  const isTransfer = station.isTransfer
  const floors = station.stationFloors ?? (isTransfer ? 3 : 2)
  const baseSize = isTransfer ? TRANSFER_STATION_SIZE : STATION_BASE_SIZE

  const stationLines = lines.filter(l => l.stationIds.includes(station.id))
  const primaryColor = stationLines.length > 0
    ? hexToThreeColor(stationLines[0].color)
    : new THREE.Color(0x888888)

  if (lodLevel === 'low') {
    const geo = new THREE.BoxGeometry(baseSize * 0.6, STATION_FLOOR_HEIGHT * 0.8, baseSize * 0.6)
    const mat = new THREE.MeshPhongMaterial({
      color: primaryColor,
      transparent: true,
      opacity: 0.85
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.y = -STATION_FLOOR_HEIGHT * 0.3
    mesh.userData = { type: 'station', stationId: station.id }
    group.add(mesh)
  } else if (lodLevel === 'medium') {
    const height = STATION_FLOOR_HEIGHT * (isTransfer ? floors * 0.6 : 1)
    const geo = new THREE.CylinderGeometry(baseSize * 0.4, baseSize * 0.5, height, 8)
    const mat = new THREE.MeshPhongMaterial({
      color: primaryColor,
      transparent: true,
      opacity: 0.85,
      shininess: 40
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.y = -height / 2
    mesh.userData = { type: 'station', stationId: station.id }
    group.add(mesh)
  } else {
    if (isTransfer) {
      for (let i = 0; i < floors; i++) {
        const floorSize = baseSize - i * 0.6
        const floorGeo = new THREE.BoxGeometry(floorSize, 0.6, floorSize)
        const floorColor = stationLines[i % stationLines.length]
          ? hexToThreeColor(stationLines[i % stationLines.length].color)
          : new THREE.Color(0x888888)
        const floorMat = new THREE.MeshPhongMaterial({
          color: floorColor,
          transparent: true,
          opacity: 0.88,
          shininess: 60
        })
        const floorMesh = new THREE.Mesh(floorGeo, floorMat)
        floorMesh.position.y = -i * STATION_FLOOR_HEIGHT - 0.3
        floorMesh.userData = { type: 'station-floor', stationId: station.id, floor: i }
        group.add(floorMesh)

        if (i < floors - 1) {
          const pillarGeo = new THREE.CylinderGeometry(0.25, 0.25, STATION_FLOOR_HEIGHT - 0.6, 8)
          const pillarMat = new THREE.MeshPhongMaterial({ color: 0xbbbbbb })
          const offsets = [
            [-floorSize / 2 + 0.4, -(STATION_FLOOR_HEIGHT * 0.5 + i * STATION_FLOOR_HEIGHT), -floorSize / 2 + 0.4],
            [floorSize / 2 - 0.4, -(STATION_FLOOR_HEIGHT * 0.5 + i * STATION_FLOOR_HEIGHT), -floorSize / 2 + 0.4],
            [-floorSize / 2 + 0.4, -(STATION_FLOOR_HEIGHT * 0.5 + i * STATION_FLOOR_HEIGHT), floorSize / 2 - 0.4],
            [floorSize / 2 - 0.4, -(STATION_FLOOR_HEIGHT * 0.5 + i * STATION_FLOOR_HEIGHT), floorSize / 2 - 0.4]
          ]
          for (const [ox, oy, oz] of offsets) {
            const pillar = new THREE.Mesh(pillarGeo, pillarMat)
            pillar.position.set(ox, oy, oz)
            group.add(pillar)
          }
        }
      }
    } else {
      const height = STATION_FLOOR_HEIGHT * 0.8
      const geo = new THREE.BoxGeometry(baseSize, height, baseSize)
      const mat = new THREE.MeshPhongMaterial({
        color: primaryColor,
        transparent: true,
        opacity: 0.9,
        shininess: 60
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.y = -height / 2
      mesh.userData = { type: 'station', stationId: station.id }
      group.add(mesh)
    }
  }

  const labelCanvas = document.createElement('canvas')
  labelCanvas.width = 512
  labelCanvas.height = 128
  const ctx = labelCanvas.getContext('2d')!
  ctx.clearRect(0, 0, 512, 128)
  drawRoundedRect(ctx, 0, 0, 512, 128, 16)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 46px Microsoft YaHei, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(station.name, 256, 64)
  const texture = new THREE.CanvasTexture(labelCanvas)
  texture.needsUpdate = true
  const labelMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false
  })
  const sprite = new THREE.Sprite(labelMaterial)
  sprite.scale.set(10, 2.5, 1)
  sprite.position.y = 1
  sprite.userData = { type: 'label', stationId: station.id }
  group.add(sprite)

  group.userData = { type: 'station-group', stationId: station.id, lodLevel: 'high' }
  return group
}

export function rebuildStationMesh(station: Station, lines: MetroLine[], lodLevel: 'high' | 'medium' | 'low', oldGroup: THREE.Group): THREE.Group {
  oldGroup.position.y
  return buildStationMesh(station, lines, lodLevel)
}

export function buildTrainMesh(line: MetroLine): THREE.Group {
  const group = new THREE.Group()
  const color = hexToThreeColor(line.color)
  const carriageLength = TRAIN_LENGTH / TRAIN_CARRIAGES

  for (let i = 0; i < TRAIN_CARRIAGES; i++) {
    const carriageGroup = new THREE.Group()

    const carriageGeo = new THREE.BoxGeometry(TRAIN_WIDTH, TRAIN_HEIGHT, carriageLength * 0.9)
    const carriageMat = new THREE.MeshPhongMaterial({
      color,
      shininess: 80,
      specular: new THREE.Color(0x444444)
    })
    const carriage = new THREE.Mesh(carriageGeo, carriageMat)
    carriageGroup.add(carriage)

    const windowY = TRAIN_HEIGHT * 0.15
    const windowW = TRAIN_WIDTH * 0.85
    const windowH = TRAIN_HEIGHT * 0.35
    const windowMat = new THREE.MeshPhongMaterial({
      color: 0xffffee,
      emissive: 0xffffee,
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.85
    })
    const windowGeo = new THREE.PlaneGeometry(windowW, windowH)
    const leftWindow = new THREE.Mesh(windowGeo, windowMat)
    leftWindow.position.set(-TRAIN_WIDTH / 2 - 0.01, windowY, 0)
    leftWindow.rotation.y = -Math.PI / 2
    carriageGroup.add(leftWindow)

    const rightWindow = new THREE.Mesh(windowGeo, windowMat)
    rightWindow.position.set(TRAIN_WIDTH / 2 + 0.01, windowY, 0)
    rightWindow.rotation.y = Math.PI / 2
    carriageGroup.add(rightWindow)

    const doorMat = new THREE.MeshPhongMaterial({
      color: color.clone().multiplyScalar(0.65),
      shininess: 60
    })
    const doorWidth = TRAIN_WIDTH * 0.12
    const doorHeight = TRAIN_HEIGHT * 0.6
    const doorGeo = new THREE.BoxGeometry(0.1, doorHeight, doorWidth)

    const leftDoor1 = new THREE.Mesh(doorGeo, doorMat)
    leftDoor1.position.set(-TRAIN_WIDTH / 2, -doorHeight / 2 + 0.15, -carriageLength * 0.15)
    leftDoor1.name = 'leftDoor1'
    carriageGroup.add(leftDoor1)

    const leftDoor2 = new THREE.Mesh(doorGeo, doorMat)
    leftDoor2.position.set(-TRAIN_WIDTH / 2, -doorHeight / 2 + 0.15, carriageLength * 0.15)
    leftDoor2.name = 'leftDoor2'
    carriageGroup.add(leftDoor2)

    const rightDoor1 = new THREE.Mesh(doorGeo, doorMat)
    rightDoor1.position.set(TRAIN_WIDTH / 2, -doorHeight / 2 + 0.15, -carriageLength * 0.15)
    rightDoor1.name = 'rightDoor1'
    carriageGroup.add(rightDoor1)

    const rightDoor2 = new THREE.Mesh(doorGeo, doorMat)
    rightDoor2.position.set(TRAIN_WIDTH / 2, -doorHeight / 2 + 0.15, carriageLength * 0.15)
    rightDoor2.name = 'rightDoor2'
    carriageGroup.add(rightDoor2)

    const roofGeo = new THREE.BoxGeometry(TRAIN_WIDTH * 0.9, 0.18, carriageLength * 0.82)
    const roofMat = new THREE.MeshPhongMaterial({
      color: color.clone().multiplyScalar(0.55),
      shininess: 100
    })
    const roof = new THREE.Mesh(roofGeo, roofMat)
    roof.position.y = TRAIN_HEIGHT / 2 + 0.09
    carriageGroup.add(roof)

    const offset = (i - (TRAIN_CARRIAGES - 1) / 2) * carriageLength
    carriageGroup.position.z = offset
    carriageGroup.userData = { type: 'carriage', index: i }
    group.add(carriageGroup)
  }

  const headlightGeo = new THREE.CircleGeometry(0.3, 16)
  const headlightMat = new THREE.MeshPhongMaterial({
    color: 0xffffaa,
    emissive: 0xffff88,
    emissiveIntensity: 0.9,
    transparent: true,
    opacity: 0.95
  })
  const frontLight = new THREE.Mesh(headlightGeo, headlightMat)
  frontLight.position.set(0, -0.2, TRAIN_LENGTH / 2 + 0.02)
  group.add(frontLight)

  const rearLight = new THREE.Mesh(headlightGeo, new THREE.MeshPhongMaterial({
    color: 0xff4444,
    emissive: 0xff0000,
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.95
  }))
  rearLight.position.set(0, -0.2, -TRAIN_LENGTH / 2 - 0.02)
  rearLight.rotation.y = Math.PI
  group.add(rearLight)

  group.userData = { type: 'train', lineId: line.id, doorsOpen: false, doorProgress: 0 }
  return group
}

export function setTrainDoors(trainGroup: THREE.Group, openAmount: number) {
  const clamped = Math.max(0, Math.min(1, openAmount))
  const doorMove = clamped * 0.7

  trainGroup.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if (child.name === 'leftDoor1' || child.name === 'leftDoor2') {
        child.position.x = -TRAIN_WIDTH / 2 - doorMove
      } else if (child.name === 'rightDoor1' || child.name === 'rightDoor2') {
        child.position.x = TRAIN_WIDTH / 2 + doorMove
      }
    }
  })

  trainGroup.userData.doorProgress = clamped
  trainGroup.userData.doorsOpen = clamped > 0.5
}

export function getTrainsPerLine(): number {
  return TRAINS_PER_LINE
}

export function buildGroundPlane(mapData: MetroMapData): THREE.Mesh {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (const s of mapData.stations) {
    const x = s.x * 0.1
    const z = -s.y * 0.1
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minZ = Math.min(minZ, z)
    maxZ = Math.max(maxZ, z)
  }
  const padding = 80
  const width = (maxX - minX) + padding * 2
  const depth = (maxZ - minZ) + padding * 2
  const centerX = (minX + maxX) / 2
  const centerZ = (minZ + maxZ) / 2

  const geometry = new THREE.PlaneGeometry(width, depth)
  const material = new THREE.MeshPhongMaterial({
    color: 0x2d4a1a,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.set(centerX, 0, centerZ)
  mesh.receiveShadow = true
  mesh.userData = { type: 'ground' }
  return mesh
}

export function buildCityBuildings(mapData: MetroMapData): THREE.InstancedMesh {
  const buildingCount = Math.min(mapData.stations.length * 6, 100)
  const geometry = new THREE.BoxGeometry(1, 1, 1)
  const material = new THREE.MeshPhongMaterial({
    color: 0x607080,
    transparent: true,
    opacity: 0.4,
    shininess: 10
  })
  const instancedMesh = new THREE.InstancedMesh(geometry, material, buildingCount)

  const dummy = new THREE.Object3D()
  let idx = 0

  for (const station of mapData.stations) {
    const sx = station.x * 0.1
    const sz = -station.y * 0.1
    const buildingsPerStation = Math.min(6, buildingCount - idx)
    for (let i = 0; i < buildingsPerStation; i++) {
      const angle = (i / buildingsPerStation) * Math.PI * 2 + Math.random() * 0.5
      const dist = 10 + Math.random() * 18
      const bw = 2 + Math.random() * 5
      const bh = 3 + Math.random() * 15
      const bd = 2 + Math.random() * 5

      dummy.position.set(sx + Math.cos(angle) * dist, bh / 2, sz + Math.sin(angle) * dist)
      dummy.scale.set(bw, bh, bd)
      dummy.updateMatrix()
      instancedMesh.setMatrixAt(idx, dummy.matrix)

      const baseTone = 0.4 + Math.random() * 0.25
      instancedMesh.setColorAt(idx, new THREE.Color(
        baseTone * 0.7,
        baseTone * 0.75,
        baseTone * 0.85
      ))
      idx++
    }
  }
  instancedMesh.instanceMatrix.needsUpdate = true
  if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true
  instancedMesh.userData = { type: 'buildings' }
  return instancedMesh
}

export function buildGridHelper(): THREE.GridHelper {
  const grid = new THREE.GridHelper(400, 80, 0x334455, 0x223344)
  grid.material.transparent = true
  grid.material.opacity = 0.15
  grid.userData = { type: 'grid' }
  return grid
}
