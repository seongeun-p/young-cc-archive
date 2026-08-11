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
    height: window.innerHeight - 130,
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
  const h = window.innerHeight - 130;
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

    // Click: show detail (distinguish from drag)
    let pointerDown = null;
    el.addEventListener('pointerdown', (e) => {
      pointerDown = { x: e.clientX, y: e.clientY, time: Date.now() };
    });
    el.addEventListener('pointerup', (e) => {
      if (!pointerDown) return;
      const dx = e.clientX - pointerDown.x;
      const dy = e.clientY - pointerDown.y;
      const dt = Date.now() - pointerDown.time;
      // Only count as click if minimal movement and short duration
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5 && dt < 300) {
        showDetail(work);
      }
      pointerDown = null;
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
  delete uploadForm.dataset.editIndex;
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

  const editIndex = uploadForm.dataset.editIndex;
  if (editIndex !== undefined && editIndex !== '') {
    // Editing existing work
    const idx = parseInt(editIndex);
    work.createdAt = works[idx].createdAt; // preserve original timestamp
    works[idx] = work;
    delete uploadForm.dataset.editIndex;

    // Rebuild physics world
    for (const [bodyId, el] of domMap.entries()) {
      el.remove();
      const body = Composite.allBodies(world).find(b => b.id === bodyId);
      if (body) Composite.remove(world, body);
    }
    bodyMap.clear();
    domMap.clear();
    saveWorks();
    loadWorks();
  } else {
    // New work
    works.push(work);
    saveWorks();
    addWorkToWorld(work, works.length - 1);
  }

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
let currentDetailWork = null;
let currentDetailIndex = -1;

function showDetail(work) {
  // Find the index of this work in the array
  currentDetailIndex = works.findIndex(w => w.createdAt === work.createdAt && w.title === work.title);
  currentDetailWork = work;

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

// Edit work
document.getElementById('edit-work').addEventListener('click', () => {
  if (currentDetailIndex < 0) return;
  const work = works[currentDetailIndex];

  // Close detail, open upload panel pre-filled
  detailPanel.classList.add('hidden');
  openUploadPanel(null);

  // Fill form with existing data
  document.getElementById('work-title').value = work.title || '';
  document.getElementById('work-creator').value = work.creator || '';
  document.getElementById('work-link').value = work.link || '';
  document.getElementById('work-description').value = work.description || '';
  pendingImageData = work.image;

  // Show image preview
  let previewImg = imagePreview.querySelector('img');
  if (!previewImg) {
    previewImg = document.createElement('img');
    imagePreview.appendChild(previewImg);
  }
  previewImg.src = work.image;
  imagePreview.querySelector('p').style.display = 'none';

  // Mark as editing
  uploadForm.dataset.editIndex = currentDetailIndex;
});

// Delete work
document.getElementById('delete-work').addEventListener('click', () => {
  if (currentDetailIndex < 0) return;
  if (!confirm('이 작업물을 삭제하시겠습니까?')) return;

  works.splice(currentDetailIndex, 1);
  saveWorks();
  detailPanel.classList.add('hidden');

  // Remove all physics bodies and DOM elements, reload
  for (const [bodyId, el] of domMap.entries()) {
    el.remove();
    const body = Composite.allBodies(world).find(b => b.id === bodyId);
    if (body) Composite.remove(world, body);
  }
  bodyMap.clear();
  domMap.clear();
  loadWorks();
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
  const h = window.innerHeight - 130;
  render.options.width = window.innerWidth;
  render.options.height = h;
  render.canvas.width = window.innerWidth;
  render.canvas.height = h;

  // Recreate walls
  const allBodies = Composite.allBodies(world);
  const staticBodies = allBodies.filter(b => b.isStatic);
  Composite.remove(world, staticBodies);
  createWalls();
});

// ===== List Panel (left hover) =====
const listTrigger = document.getElementById('list-trigger');
const listPanel = document.getElementById('list-panel');
const listContent = document.getElementById('list-content');
let currentSort = 'creator';

// Show panel on hover
listTrigger.addEventListener('mouseenter', () => {
  renderList();
  listPanel.classList.add('visible');
});

listPanel.addEventListener('mouseleave', (e) => {
  // Hide only if mouse leaves the panel entirely
  const rect = listPanel.getBoundingClientRect();
  if (e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
    listPanel.classList.remove('visible');
  }
});

listPanel.addEventListener('mouseenter', () => {
  listPanel.classList.add('visible');
});

// Also hide when mouse moves far from left
document.addEventListener('mousemove', (e) => {
  if (listPanel.classList.contains('visible') && e.clientX > 350) {
    listPanel.classList.remove('visible');
  }
});

// Sort buttons
document.querySelectorAll('.sort-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentSort = btn.dataset.sort;
    renderList();
  });
});

function renderList() {
  listContent.innerHTML = '';

  if (works.length === 0) {
    listContent.innerHTML = '<p style="font-size:13px;color:#999;">아직 등록된 작업물이 없습니다.</p>';
    return;
  }

  if (currentSort === 'creator') {
    renderByCreator();
  } else {
    renderByYear();
  }
}

function renderByCreator() {
  // Group by creator
  const groups = {};
  works.forEach((work, i) => {
    const key = work.creator || '알 수 없음';
    if (!groups[key]) groups[key] = [];
    groups[key].push({ ...work, index: i });
  });

  // Sort creator names in Korean alphabetical order (가나다)
  const sortedKeys = Object.keys(groups).sort((a, b) => a.localeCompare(b, 'ko'));

  sortedKeys.forEach(creator => {
    // Sort works by newest first
    const items = groups[creator].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const groupEl = document.createElement('div');
    groupEl.className = 'list-group';

    const titleEl = document.createElement('div');
    titleEl.className = 'list-group-title';
    titleEl.textContent = creator;
    groupEl.appendChild(titleEl);

    const ul = document.createElement('ul');
    ul.className = 'list-group-items';
    items.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item.title || '제목 없음';
      li.addEventListener('click', () => showDetail(item));
      ul.appendChild(li);
    });
    groupEl.appendChild(ul);
    listContent.appendChild(groupEl);
  });
}

function renderByYear() {
  // Group by year
  const groups = {};
  works.forEach((work, i) => {
    const date = work.createdAt ? new Date(work.createdAt) : null;
    const key = date ? date.getFullYear().toString() : '날짜 없음';
    if (!groups[key]) groups[key] = [];
    groups[key].push({ ...work, index: i });
  });

  // Sort years descending (newest first)
  const sortedKeys = Object.keys(groups).sort((a, b) => {
    if (a === '날짜 없음') return 1;
    if (b === '날짜 없음') return -1;
    return parseInt(b) - parseInt(a);
  });

  sortedKeys.forEach(year => {
    // Sort works by newest first within year
    const items = groups[year].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const groupEl = document.createElement('div');
    groupEl.className = 'list-group';

    const titleEl = document.createElement('div');
    titleEl.className = 'list-group-title';
    titleEl.textContent = year;
    groupEl.appendChild(titleEl);

    const ul = document.createElement('ul');
    ul.className = 'list-group-items';
    items.forEach(item => {
      const li = document.createElement('li');
      li.textContent = `${item.title || '제목 없음'} — ${item.creator}`;
      li.addEventListener('click', () => showDetail(item));
      ul.appendChild(li);
    });
    groupEl.appendChild(ul);
    listContent.appendChild(groupEl);
  });
}
