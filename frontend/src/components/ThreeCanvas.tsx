import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type {
  NormalizationResponse,
  NormalizationTable
} from '@shared/types';

const BLOCK_WIDTH = 2.3;
const BLOCK_DEPTH = 0.34;
const CANVAS_WIDTH = 512;
const HEADER_HEIGHT = 84;
const ROW_HEIGHT = 64;
const TEXTURE_SCALE = BLOCK_WIDTH / CANVAS_WIDTH;

const KNOWN_LAYOUT: Record<string, [number, number]> = {
  Customers: [-2.9, 1.2],
  Bills: [2.9, 1.2],
  Products: [-2.9, -1.9],
  BillItems: [2.9, -1.9]
};

const FALLBACK_LAYOUT: Array<[number, number]> = [
  [-2.9, 1.2],
  [2.9, 1.2],
  [-2.9, -1.9],
  [2.9, -1.9]
];

interface Accent {
  hex: number;
  css: string;
}

const KNOWN_ACCENTS: Record<string, Accent> = {
  Customers: { hex: 0x34d399, css: '#34d399' },
  Bills: { hex: 0x38bdf8, css: '#38bdf8' },
  BillItems: { hex: 0xfbbf24, css: '#fbbf24' },
  Products: { hex: 0xa78bfa, css: '#a78bfa' }
};

const FALLBACK_ACCENTS: Accent[] = [
  { hex: 0x34d399, css: '#34d399' },
  { hex: 0x38bdf8, css: '#38bdf8' },
  { hex: 0xfbbf24, css: '#fbbf24' },
  { hex: 0xa78bfa, css: '#a78bfa' },
  { hex: 0xf472b6, css: '#f472b6' }
];

interface TableMeta {
  name: string;
  group: THREE.Group;
  target: THREE.Vector3;
  anchors: Map<string, THREE.Vector3>;
  fadeMaterials: THREE.Material[];
  edgeMaterial: THREE.LineBasicMaterial;
  hitMesh: THREE.Mesh;
}

interface ThreeCanvasProps {
  normalization: NormalizationResponse;
  selectedTableName: string | null;
  animationSignal: number;
  onSelectTable: (tableName: string | null) => void;
  onWebGLUnavailable: () => void;
  className?: string;
}

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl2') || canvas.getContext('webgl'))
    );
  } catch {
    return false;
  }
}

function accentFor(name: string, index: number): Accent {
  return KNOWN_ACCENTS[name] ?? FALLBACK_ACCENTS[index % FALLBACK_ACCENTS.length];
}

function targetFor(name: string, index: number): THREE.Vector3 {
  const known = KNOWN_LAYOUT[name] ?? FALLBACK_LAYOUT[index % FALLBACK_LAYOUT.length];
  return new THREE.Vector3(known[0], known[1], 0);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function tableCanvasHeight(fieldCount: number): number {
  return HEADER_HEIGHT + fieldCount * ROW_HEIGHT + 14;
}

function createTableTexture(
  table: NormalizationTable,
  accent: Accent
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = tableCanvasHeight(table.fields.length);
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const background = ctx.createLinearGradient(0, 0, 0, canvas.height);
    background.addColorStop(0, '#0f1b2e');
    background.addColorStop(1, '#070d18');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = accent.css;
    ctx.fillRect(0, 0, canvas.width, 6);

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 30px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(table.name, 24, 44);

    ctx.textAlign = 'right';
    ctx.fillStyle = accent.css;
    ctx.font = '700 15px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`${table.fields.length} FIELDS`, CANVAS_WIDTH - 24, 45);

    table.fields.forEach((field, index) => {
      const rowTop = HEADER_HEIGHT + index * ROW_HEIGHT;

      ctx.fillStyle =
        index % 2 === 0 ? 'rgba(15, 23, 42, 0.55)' : 'rgba(30, 41, 59, 0.35)';
      ctx.fillRect(0, rowTop, CANVAS_WIDTH, ROW_HEIGHT);

      const marker = field.primaryKey ? 'PK' : field.foreignKey ? 'FK' : null;
      if (marker) {
        const badgeColor = field.primaryKey ? '#fbbf24' : '#38bdf8';
        ctx.fillStyle = field.primaryKey
          ? 'rgba(251, 191, 36, 0.16)'
          : 'rgba(56, 189, 248, 0.16)';
        roundRect(ctx, 24, rowTop + 18, 42, 28, 8);
        ctx.fill();
        ctx.textAlign = 'center';
        ctx.fillStyle = badgeColor;
        ctx.font = '700 15px "Segoe UI", system-ui, sans-serif';
        ctx.fillText(marker, 45, rowTop + 33);
      }

      ctx.textAlign = 'left';
      ctx.fillStyle = marker ? '#e2e8f0' : '#cbd5e1';
      ctx.font = `${marker ? '600' : '500'} 21px "Cascadia Code", Consolas, monospace`;
      ctx.fillText(field.name, marker ? 80 : 24, rowTop + 33);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#64748b';
      ctx.font = '500 15px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(field.type.toUpperCase(), CANVAS_WIDTH - 24, rowTop + 33);

      ctx.strokeStyle = 'rgba(51, 65, 85, 0.5)';
      ctx.beginPath();
      ctx.moveTo(16, rowTop + ROW_HEIGHT);
      ctx.lineTo(CANVAS_WIDTH - 16, rowTop + ROW_HEIGHT);
      ctx.stroke();
    });

    ctx.fillStyle = accent.css;
    ctx.fillRect(0, canvas.height - 5, canvas.width, 5);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createMonolithTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = 460;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const background = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    background.addColorStop(0, '#1e293b');
    background.addColorStop(1, '#020617');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 16px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('FLAT BILL RECORD', 30, 48);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 34px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('Bills', 30, 96);

    ctx.fillStyle = 'rgba(148, 163, 184, 0.9)';
    ctx.font = '500 18px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('before normalization · repeating values', 30, 132);

    const rows = [
      'bill_number',
      'bill_date',
      'customer_name',
      'customer_contact',
      'item_description[]',
      'quantity[]',
      'unit_price[]',
      'grand_total'
    ];

    rows.forEach((row, index) => {
      const rowTop = 172 + index * 32;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
      ctx.fillRect(30, rowTop, canvas.width - 60, 27);
      ctx.fillStyle = index >= 4 ? '#fbbf24' : '#cbd5e1';
      ctx.font = '500 16px "Cascadia Code", Consolas, monospace';
      ctx.fillText(row, 42, rowTop + 14);
    });

    ctx.fillStyle = 'rgba(251, 191, 36, 0.12)';
    roundRect(ctx, 30, 428, 214, 26, 8);
    ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.font = '700 13px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('1NF / 2NF VIOLATIONS', 44, 441);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createRelationshipLabel(
  label: string,
  detail: string,
  accent: Accent
): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 150;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(2, 6, 23, 0.92)';
    roundRect(ctx, 8, 8, canvas.width - 16, canvas.height - 16, 26);
    ctx.fill();
    ctx.strokeStyle = accent.css;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = accent.css;
    ctx.font = '700 34px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(label, canvas.width / 2, 58);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 21px "Cascadia Code", Consolas, monospace';
    ctx.fillText(detail, canvas.width / 2, 104);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    depthWrite: false
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.15, 0.63, 1);
  return sprite;
}

function easeInOutCubic(value: number): number {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function disposeMaterial(material: THREE.Material): void {
  const record = material as unknown as Record<string, unknown>;
  for (const key of ['map', 'alphaMap', 'emissiveMap']) {
    const value = record[key];
    if (value instanceof THREE.Texture) value.dispose();
  }
  material.dispose();
}

export default function ThreeCanvas({
  normalization,
  selectedTableName,
  animationSignal,
  onSelectTable,
  onWebGLUnavailable,
  className
}: ThreeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelectTable);
  const onUnavailableRef = useRef(onWebGLUnavailable);
  const selectedRef = useRef(selectedTableName);
  const [unsupported, setUnsupported] = useState(false);

  onSelectRef.current = onSelectTable;
  onUnavailableRef.current = onWebGLUnavailable;
  selectedRef.current = selectedTableName;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!supportsWebGL()) {
      setUnsupported(true);
      onUnavailableRef.current();
      return;
    }

    setUnsupported(false);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.cursor = 'grab';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 4.5;
    controls.maxDistance = 22;
    controls.minPolarAngle = Math.PI * 0.16;
    controls.maxPolarAngle = Math.PI * 0.86;
    controls.target.set(0, -0.15, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.15);
    keyLight.position.set(5, 7, 9);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.55);
    rimLight.position.set(-7, 3, -5);
    scene.add(rimLight);
    const warmLight = new THREE.PointLight(0xfbbf24, 22, 24, 2);
    warmLight.position.set(0, -1, 6);
    scene.add(warmLight);

    const grid = new THREE.GridHelper(18, 18, 0x1e293b, 0x0f172a);
    grid.position.y = -4.4;
    const gridMaterials = Array.isArray(grid.material)
      ? grid.material
      : [grid.material];
    gridMaterials.forEach((material) => {
      material.transparent = true;
      material.opacity = 0.35;
    });
    scene.add(grid);

    const tablesGroup = new THREE.Group();
    scene.add(tablesGroup);

    const tableMetas: TableMeta[] = [];
    const pickables: THREE.Mesh[] = [];
    const tableMetaByName = new Map<string, TableMeta>();

    normalization.tables.forEach((table, index) => {
      const accent = accentFor(table.name, index);
      const group = new THREE.Group();
      const height =
        tableCanvasHeight(table.fields.length) * TEXTURE_SCALE;
      const texture = createTableTexture(table, accent);

      const sideMaterial = () =>
        new THREE.MeshStandardMaterial({
          color: 0x0b1220,
          metalness: 0.3,
          roughness: 0.55,
          transparent: true,
          opacity: 0,
          emissive: accent.hex,
          emissiveIntensity: 0.08
        });

      const frontMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0,
        toneMapped: false
      });

      const materials: THREE.Material[] = [
        sideMaterial(),
        sideMaterial(),
        sideMaterial(),
        sideMaterial(),
        frontMaterial,
        sideMaterial()
      ];

      const geometry = new THREE.BoxGeometry(BLOCK_WIDTH, height, BLOCK_DEPTH);
      const block = new THREE.Mesh(geometry, materials);
      group.add(block);

      const edgeMaterial = new THREE.LineBasicMaterial({
        color: accent.hex,
        transparent: true,
        opacity: 0
      });
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        edgeMaterial
      );
      edges.scale.setScalar(1.025);
      group.add(edges);

      const hitMesh = new THREE.Mesh(
        new THREE.BoxGeometry(BLOCK_WIDTH + 0.35, height + 0.3, 0.8),
        new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          depthWrite: false
        })
      );
      hitMesh.userData.tableName = table.name;
      group.add(hitMesh);
      pickables.push(hitMesh);

      const anchors = new Map<string, THREE.Vector3>();
      table.fields.forEach((field, fieldIndex) => {
        const anchorY =
          height / 2 -
          (HEADER_HEIGHT + fieldIndex * ROW_HEIGHT + ROW_HEIGHT / 2) *
            TEXTURE_SCALE;
        anchors.set(field.name, new THREE.Vector3(0, anchorY, BLOCK_DEPTH / 2 + 0.02));
      });

      const target = targetFor(table.name, index);
      group.position.set(0, 0, 0);
      group.scale.setScalar(0.55);
      tablesGroup.add(group);

      const meta: TableMeta = {
        name: table.name,
        group,
        target,
        anchors,
        fadeMaterials: materials,
        edgeMaterial,
        hitMesh
      };
      tableMetas.push(meta);
      tableMetaByName.set(table.name, meta);
    });

    const monolithGroup = new THREE.Group();
    const monolithTexture = createMonolithTexture();
    const monolithMaterials: THREE.Material[] = [
      new THREE.MeshStandardMaterial({
        color: 0x0b1220,
        metalness: 0.35,
        roughness: 0.5,
        transparent: true,
        opacity: 1,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.06
      }),
      new THREE.MeshStandardMaterial({
        color: 0x0b1220,
        metalness: 0.35,
        roughness: 0.5,
        transparent: true,
        opacity: 1,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.06
      }),
      new THREE.MeshStandardMaterial({
        color: 0x0b1220,
        transparent: true,
        opacity: 1
      }),
      new THREE.MeshStandardMaterial({
        color: 0x0b1220,
        transparent: true,
        opacity: 1
      }),
      new THREE.MeshBasicMaterial({
        map: monolithTexture,
        transparent: true,
        opacity: 1,
        toneMapped: false
      }),
      new THREE.MeshStandardMaterial({
        color: 0x0b1220,
        transparent: true,
        opacity: 1
      })
    ];
    const monolith = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 2.5, 0.5),
      monolithMaterials
    );
    monolithGroup.add(monolith);
    const monolithEdgeMaterial = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.8
    });
    const monolithEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(monolith.geometry),
      monolithEdgeMaterial
    );
    monolithGroup.add(monolithEdges);
    monolithGroup.position.set(0, 0.15, 0);
    scene.add(monolithGroup);

    const relationshipGroup = new THREE.Group();
    const relationshipMaterials: THREE.Material[] = [];
    scene.add(relationshipGroup);

    normalization.relationships.forEach((relationship) => {
      const [fromTable, fromField] = relationship.from.split('.');
      const [toTable, toField] = relationship.to.split('.');
      const fromMeta = tableMetaByName.get(fromTable);
      const toMeta = tableMetaByName.get(toTable);
      if (!fromMeta || !toMeta) return;

      const fromAnchor =
        fromMeta.anchors.get(fromField) ?? new THREE.Vector3(0, 0, 0.2);
      const toAnchor =
        toMeta.anchors.get(toField) ?? new THREE.Vector3(0, 0, 0.2);

      const start = fromMeta.target.clone().add(fromAnchor);
      const end = toMeta.target.clone().add(toAnchor);
      const mid = start.clone().lerp(end, 0.5);
      const control = mid.clone().add(
        new THREE.Vector3(
          0,
          Math.max(0.6, Math.abs(start.y - end.y) * 0.35),
          2.4
        )
      );

      const curve = new THREE.QuadraticBezierCurve3(start, control, end);
      const accent = accentFor(fromTable, 0);

      const tubeMaterial = new THREE.MeshBasicMaterial({
        color: accent.hex,
        transparent: true,
        opacity: 0
      });
      relationshipMaterials.push(tubeMaterial);
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 48, 0.026, 8, false),
        tubeMaterial
      );
      relationshipGroup.add(tube);

      const tangent = curve.getTangent(0.985).normalize();
      const coneMaterial = new THREE.MeshBasicMaterial({
        color: accent.hex,
        transparent: true,
        opacity: 0
      });
      relationshipMaterials.push(coneMaterial);
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.1, 0.26, 12),
        coneMaterial
      );
      cone.position.copy(curve.getPoint(0.985));
      cone.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        tangent
      );
      relationshipGroup.add(cone);

      const label = createRelationshipLabel(
        relationship.label,
        `${fromField} → ${toField}`,
        accent
      );
      label.position.copy(curve.getPoint(0.52));
      relationshipMaterials.push(label.material);
      relationshipGroup.add(label);
    });

    let userInteracted = false;
    const onControlStart = () => {
      userInteracted = true;
      renderer.domElement.style.cursor = 'grabbing';
    };
    const onControlEnd = () => {
      renderer.domElement.style.cursor = 'grab';
    };
    controls.addEventListener('start', onControlStart);
    controls.addEventListener('end', onControlEnd);

    const fitCamera = () => {
      const width = container.clientWidth || 320;
      const height = container.clientHeight || 360;
      const aspect = width / height;
      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const fitHeight = 6.3;
      const fitWidth = 8.9;
      const distanceForHeight = fitHeight / 2 / Math.tan(verticalFov / 2);
      const distanceForWidth =
        fitWidth / 2 / (Math.tan(verticalFov / 2) * aspect);
      const distance = Math.max(distanceForHeight, distanceForWidth) * 0.98;
      camera.position.set(0, 1.15, distance);
      camera.lookAt(controls.target);
      camera.updateProjectionMatrix();
    };

    const resize = () => {
      const width = container.clientWidth || 320;
      const height = container.clientHeight || 360;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      if (!userInteracted) {
        fitCamera();
      } else {
        camera.updateProjectionMatrix();
      }
    };

    fitCamera();
    resize();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDown: { x: number; y: number } | null = null;

    const onPointerDown = (event: PointerEvent) => {
      pointerDown = { x: event.clientX, y: event.clientY };
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!pointerDown) return;
      const moved = Math.hypot(
        event.clientX - pointerDown.x,
        event.clientY - pointerDown.y
      );
      pointerDown = null;
      if (moved > 8) return;

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(pickables, false);
      const tableName = hits[0]?.object.userData.tableName as
        | string
        | undefined;
      onSelectRef.current(tableName ?? null);
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const onContextLost = (event: Event) => {
      event.preventDefault();
      onUnavailableRef.current();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    const animationStart = performance.now();
    let animationComplete = false;
    let frame = 0;

    const animate = () => {
      frame = requestAnimationFrame(animate);

      const progress = Math.min(1, (performance.now() - animationStart) / 1700);
      const eased = easeInOutCubic(progress);

      if (!animationComplete) {
        const monolithOpacity = Math.max(0, 1 - eased * 1.15);
        monolithMaterials.forEach((material) => {
          material.opacity = monolithOpacity;
        });
        monolithEdges.visible = monolithOpacity > 0.05;
        monolithEdgeMaterial.opacity = monolithOpacity * 0.8;
        monolithGroup.scale.setScalar(1 - eased * 0.2);

        tableMetas.forEach((meta) => {
          meta.group.position.lerpVectors(
            new THREE.Vector3(0, 0, 0),
            meta.target,
            eased
          );
          const scale = 0.55 + 0.45 * eased;
          meta.group.scale.setScalar(scale);
          meta.fadeMaterials.forEach((material) => {
            material.opacity = eased;
          });
        });

        const relationshipOpacity = Math.max(0, (eased - 0.62) / 0.38);
        relationshipMaterials.forEach((material) => {
          material.opacity = relationshipOpacity;
        });

        if (progress >= 1) {
          animationComplete = true;
          monolithGroup.visible = false;
          tableMetas.forEach((meta) => {
            meta.group.position.copy(meta.target);
            meta.group.scale.setScalar(1);
            meta.fadeMaterials.forEach((material) => {
              material.opacity = 1;
            });
          });
          relationshipMaterials.forEach((material) => {
            material.opacity = 1;
          });
        }
      }

      tableMetas.forEach((meta) => {
        meta.edgeMaterial.opacity =
          meta.name === selectedRef.current && animationComplete ? 0.95 : 0;
      });

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener(
        'webglcontextlost',
        onContextLost
      );
      controls.removeEventListener('start', onControlStart);
      controls.removeEventListener('end', onControlEnd);
      controls.dispose();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material as
          | THREE.Material
          | THREE.Material[]
          | undefined;
        if (Array.isArray(material)) {
          material.forEach(disposeMaterial);
        } else if (material) {
          disposeMaterial(material);
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [normalization, animationSignal]);

  if (unsupported) {
    return (
      <div
        className={
          className ??
          'grid h-[360px] place-items-center rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-center'
        }
      >
        <p className="max-w-[240px] text-xs leading-relaxed text-slate-400">
          WebGL is not available on this device. Showing the accessible 2D schema
          instead.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={
        className ??
        'relative h-[360px] w-full overflow-hidden rounded-2xl border border-slate-800 bg-[radial-gradient(circle_at_50%_35%,#0f2b3a_0%,#020617_68%)]'
      }
    />
  );
}
