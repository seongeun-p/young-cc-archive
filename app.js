// ===== YOUNG C C Archive - Main Application =====

const { Engine, Render, Runner, Bodies, Body, Composite, Events, Mouse, MouseConstraint } = Matter;

// ===== State =====
let works = JSON.parse(localStorage.getItem('youngcc-works') || '[]');
let bodyMap = new Map(); // matterBody.id -> work data
let domMap = new Map(); // matterBody.id -> DOM element

// ===== Physics Setup =====
const worldEl = document.getElementById('world');
const canvas = document.getElementById('physics-canvas');
const bodiesContainer = document.getElementById('bodies-container');

const engine = Engine.create();
const world = engine.world;
engine.gravity.y = 1;

const render = Render.create({
  canvas: canvas,
  engine: engine,
  options: {
    width: window.innerWidth,
    height: window.innerHeight,
    wireframes: false,
    background: 'transparent',
    pixelRatio: window.devicePixelRatio || 1,
  }
});

// Make walls invisible
Render.run(render);
const runner = Runner.create();
Runner.run(runner, engine);

// Walls
function createWalls() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const thickness = 60;

  const floor = Bodies.rectangle(w / 2, h + thickness / 2, w * 2, thickness, { isStatic: true, render: { visible: false } });
  const leftWall = Bodies.rectangle(-thickness / 2, h / 2, thickness, h * 2, { isStatic: true, render: { visible: false } });
  const rightWall = Bodies.rectangle(w + thickness / 2, h / 2, thickness, h * 2, { isStatic: true, render: { visible: false } });

  Composite.add(world, [floor, leftWall, rightWall]);
}

createWalls();

// Mouse interaction for dragging bodies
const mouse = Mouse.create(worldEl);
const mouseConstraint = MouseConstraint.create(engine, {
  mouse: mouse,
  constraint: {
    stiffness: 0.2,
    render: { visible: false }
  }
});
Composite.add(world, mouseConstraint);

// Prevent default scrolling
mouse.element.removeEventListener('mousewheel', mouse.mousewheel);
mouse.element.removeEventListener('DOMMouseScroll', mouse.mousewheel);

// ===== Render Loop - Sync DOM with Physics =====
Events.on(engine, 'afterUpdate', () => {
  for (const [bodyId, el] of domMap.entries()) {
    const body = Composite.allBodies(world).find(b => b.id === bodyId);
    if (!body) continue;
    const { x, y } = body.position;
    const angle = body.angle;
    const w = el.dataset.width;
    const h = el.dataset.height;
    el.style.left = `${x - w / 2}px`;
    el.style.top = `${y - h / 2}px`;
    el.style.transform = `rotate(${angle}rad)`;
  }
});

// ===== Add Work to Physics World =====
function addWorkToWorld(work, index) {
  const img = new Image();
  img.onload = () => {
    // Scale image to reasonable size
    const maxSize = 150;
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    const scale = maxSize / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);

    // Random x position, drop from top
    const x = 100 + Math.random() * (window.innerWidth - 200);
    const y = -h;

    // Create physics body
    const body = Bodies.rectangle(x, y, w, h, {
      restitution: 0.3,
      friction: 0.8,
      density: 0.002,
      render: { visible: false },
    });

    Composite.add(world, body);
    bodyMap.set(body.id, work);

    // Create DOM element
    const el = document.createElement('div');
    el.className = 'body-item';
    el.dataset.width = w;
    el.dataset.height = h;
    el.dataset.workIndex = index;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;

    const imgEl = document.createElement('img');
    imgEl.src = work.image;
    imgEl.alt = work.title;
    imgEl.draggable = false;
    el.appendChild(imgEl);

    // Hover overlay
    const overlay = document.createElement('div');
    overlay.className = 'hover-overlay';
    const textEl = document.createElement('div');
    textEl.className = 'hover-text';
    textEl.innerHTML = `${work.creator}<br>${work.title}`;
    overlay.appendChild(textEl);
    el.appendChild(overlay);

    // Hover: random fluorescent color
    el.addEventListener('mouseenter', () => {
      const colors = ['#39FF14', '#FF6EC7', '#FFFF00', '#FF3503', '#04D9FF', '#FF00FF', '#CCFF00', '#FE4164'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      overlay.style.backgroundColor = color;
    });

    el.addEventListener('mouseleave', () => {
      overlay.style.backgroundColor = 'transparent';
    });

    // Click: show detail
    el.addEventListener('click', (e) => {
      // Don't open detail if user is dragging
      if (mouseConstraint.body) return;
      showDetail(work);
    });

    bodiesContainer.appendChild(el);
    domMap.set(body.id, el);
  };
  img.src = work.image;
}

// ===== Load existing works =====
function loadWorks() {
  works.forEach((work, i) => {
    addWorkToWorld(work, i);
  });
}

loadWorks();

// ===== Drag & Drop =====
const dropOverlay = document.getElementById('drop-overlay');

worldEl.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dropOverlay.classList.add('active');
});

worldEl.addEventListener('dragover', (e) => {
  e.preventDefault();
});

worldEl.addEventListener('dragleave', (e) => {
  if (e.target === dropOverlay || e.target === worldEl) {
    dropOverlay.classList.remove('active');
  }
});

worldEl.addEventListener('drop', (e) => {
  e.preventDefault();
  dropOverlay.classList.remove('active');

  const files = e.dataTransfer.files;
  if (files.length > 0 && files[0].type.startsWith('image/')) {
    openUploadPanel(files[0]);
  }
});

// Also allow clicking anywhere to upload (optional affordance)
document.addEventListener('keydown', (e) => {
  if (e.key === 'u' && !e.ctrlKey && !e.metaKey) {
    const uploadPanel = document.getElementById('upload-panel');
    const detailPanel = document.getElementById('detail-panel');
    if (uploadPanel.classList.contains('hidden') && detailPanel.classList.contains('hidden')) {
      openUploadPanel(null);
    }
  }
});

// ===== Upload Panel =====
const uploadPanel = document.getElementById('upload-panel');
const uploadForm = document.getElementById('upload-form');
const imageInput = document.getElementById('work-image');
const imagePreview = document.getElementById('image-preview');
let pendingImageData = null;

function openUploadPanel(file) {
  uploadPanel.classList.remove('hidden');
  if (file) {
    handleImageFile(file);
  }
}

function closeUploadPanel() {
  uploadPanel.classList.add('hidden');
  uploadForm.reset();
  pendingImageData = null;
  // Remove preview image if any
  const existingImg = imagePreview.querySelector('img');
  if (existingImg) existingImg.remove();
  imagePreview.querySelector('p').style.display = '';
}

document.getElementById('close-upload').addEventListener('click', closeUploadPanel);

imageInput.addEventListener('change', (e) => {
  if (e.target.files[0]) {
    handleImageFile(e.target.files[0]);
  }
});

function handleImageFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    pendingImageData = e.target.result;
    // Show preview
    let previewImg = imagePreview.querySelector('img');
    if (!previewImg) {
      previewImg = document.createElement('img');
      imagePreview.appendChild(previewImg);
    }
    previewImg.src = pendingImageData;
    imagePreview.querySelector('p').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

uploadForm.addEventListener('submit', (e) => {
  e.preventDefault();

  if (!pendingImageData) {
    alert('이미지를 선택해주세요.');
    return;
  }

  const work = {
    image: pendingImageData,
    title: document.getElementById('work-title').value.trim(),
    creator: document.getElementById('work-creator').value.trim(),
    link: document.getElementById('work-link').value.trim(),
    description: document.getElementById('work-description').value.trim(),
    createdAt: Date.now(),
  };

  works.push(work);
  saveWorks();
  addWorkToWorld(work, works.length - 1);
  closeUploadPanel();
});

function saveWorks() {
  try {
    localStorage.setItem('youngcc-works', JSON.stringify(works));
  } catch (e) {
    console.warn('localStorage full, could not save:', e);
  }
}

// ===== Detail Panel =====
const detailPanel = document.getElementById('detail-panel');

function showDetail(work) {
  document.getElementById('detail-image').src = work.image;
  document.getElementById('detail-title').textContent = work.title;
  document.getElementById('detail-creator').textContent = work.creator;

  const linkEl = document.getElementById('detail-link');
  if (work.link) {
    linkEl.href = work.link;
    linkEl.classList.remove('hidden');
  } else {
    linkEl.classList.add('hidden');
  }

  document.getElementById('detail-description').textContent = work.description || '';
  detailPanel.classList.remove('hidden');
}

document.getElementById('close-detail').addEventListener('click', () => {
  detailPanel.classList.add('hidden');
});

// Close panels on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeUploadPanel();
    detailPanel.classList.add('hidden');
  }
});

// ===== Resize handling =====
window.addEventListener('resize', () => {
  render.options.width = window.innerWidth;
  render.options.height = window.innerHeight;
  render.canvas.width = window.innerWidth;
  render.canvas.height = window.innerHeight;

  // Recreate walls
  const allBodies = Composite.allBodies(world);
  const staticBodies = allBodies.filter(b => b.isStatic);
  Composite.remove(world, staticBodies);
  createWalls();
});
