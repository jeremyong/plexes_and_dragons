const preview_canvas = document.getElementById("preview");
const swap_counter_div = document.getElementById('swap_counter');
const log_div = document.getElementById('log');

let mouse_x = 0;
let mouse_y = 0;
let coord_x = 0;
let coord_y = 0;
let prev_coord_x = 0;
let prev_coord_y = 0;

function setMousePos(e) {
  const rect = preview_canvas.getBoundingClientRect();
  const x = e.clientX !== undefined ? e.clientX : e.touches[0].pageX - Math.floor(orb_width / 3);
  const y = e.clientY !== undefined ? e.clientY : e.touches[0].pageY - Math.floor(orb_width / 3);
  mouse_x = x - rect.left;
  mouse_y = y - rect.top;
  coord_x = Math.floor(mouse_x / orb_width);
  coord_y = Math.floor(mouse_y / orb_width);
}

let drag_started = false;

let grid = [];

let movements = user_movements || [];

function save_movement(prevent_null_moves = false) {
  // Prevent storing back-and-forth transposes
  if (prevent_null_moves && movements.length >= 4) {
    const x = movements[movements.length - 4];
    const y = movements[movements.length - 3];
    if (x === coord_x && y === coord_y) {
      movements.pop();
      movements.pop();
      return;
    }
  }

  movements.push(coord_x, coord_y);
}

// Milliseconds that should elapse between each swap
let playback_interval = 300;
let start = null;

let swap_count = 0;

function check_swap(with_save = true) {
  if (prev_coord_x !== coord_x || prev_coord_y !== coord_y) {
    const tmp = grid[prev_coord_y][prev_coord_x];
    grid[prev_coord_y][prev_coord_x] = grid[coord_y][coord_x];
    grid[coord_y][coord_x] = tmp;
    prev_coord_x = coord_x;
    prev_coord_y = coord_y;
    swap_count += 1;
    swap_counter_div.innerHTML = `${swap_count} moves`;
    if (with_save) {
      save_movement();
    }
  }
}

let frozen = !!user_movements;
function restart() {
  if (start && !paused) {
    stopped = true;
  }
  frozen = !!user_movements;
  swap_count = 0;
  swap_counter_div.innerHTML = '';
  init_grid();
  start = null;
  paused = false;
  pause_position = null;
  render_update();
}

let paused = false;
let pause_position = null;
let stopped = false;
let loop_interval = 0;

function step_animation(timestamp) {
  if (stopped) {
    stopped = false;
    return;
  }

  if (!start) {
    start = timestamp;
  }

  if (!paused && pause_position !== null) {
    start = timestamp - pause_position * playback_interval;
    pause_position = null;
  }

  const r = (timestamp - start) / playback_interval;

  if (paused) {
    pause_position = r;
    return;
  }

  const initial = Math.floor(r);

  if (movements.length - 2 <= 2 * initial) {
    start = null;
    if (loop_interval) {
      setTimeout(play, loop_interval);
    }
    return;
  }

  const x_0 = movements[initial * 2];
  const y_0 = movements[initial * 2 + 1];

  const x_1 = movements[initial * 2 + 2];
  const y_1 = movements[initial * 2 + 3];

  const frac = r - initial;
  mouse_x = ((1 - frac) * x_0 + frac * x_1) * orb_width + orb_width / 2;
  mouse_y = ((1 - frac) * y_0 + frac * y_1) * orb_width + orb_width / 2;
  coord_x = Math.floor(mouse_x / orb_width);
  coord_y = Math.floor(mouse_y / orb_width);
  check_swap(false);
  render_update();

  window.requestAnimationFrame(step_animation);
}

function loop() {
  if (movements.length === 0) {
    return;
  }
  loop_interval = 3000;
  play();
}

function play() {
  if (movements.length === 0) {
    return;
  }

  frozen = true;

  restart();

  mouse_x = movements[0] * orb_width + orb_width / 2;
  mouse_y = movements[1] * orb_width + orb_width / 2;
  coord_x = Math.floor(mouse_x / orb_width);
  coord_y = Math.floor(mouse_y / orb_width);
  prev_coord_x = coord_x;
  prev_coord_y = coord_y;

  render_update();
  window.requestAnimationFrame(step_animation);
}

function pause_resume() {
  if (!start && !paused) {
    return;
  }

  paused = !paused;
  if (!paused) {
    window.requestAnimationFrame(step_animation);
  }
}

function init_grid() {
  grid = [];
  let index = 0;
  for (let i = 0; i !== orbs_height; i += 1) {
    row = [];
    grid.push(row);
    for (let j = 0; j !== orbs_width; j += 1) {
      row.push(preview_state[index]);
      index += 1;
    }
  }
}

function gesture_start(e) {
  if (start || frozen || disabled || !expanded) {
    return;
  }

  frozen = true;

  movements = [];

  init_grid();
  drag_started = true;
  setMousePos(e);

  prev_coord_x = coord_x;
  prev_coord_y = coord_y;
  save_movement();

  e.preventDefault();
}
preview_canvas.addEventListener('mousedown', gesture_start, false);
preview_canvas.addEventListener('touchstart', gesture_start, false);
document.body.addEventListener('touchstart', (e) => {
  if (e.target === preview_canvas) {
    e.preventDefault();
  }
}, false);

function gesture_move(e) {
  if (!drag_started) {
    return;
  }

  setMousePos(e);

  check_swap();

  render_update();
  e.preventDefault();
}
preview_canvas.addEventListener('mousemove', gesture_move, false);
preview_canvas.addEventListener('touchmove', gesture_move, false);
document.body.addEventListener('touchmove', (e) => {
  if (e.target === preview_canvas) {
    e.preventDefault();
  }
}, false);

window.addEventListener('touchmove', function (e) {
  if (drag_started) {
    e.preventDefault();
  }
});

function gesture_end(e) {
  if (!expanded) {
    expand();
    return;
  }

  if (!drag_started) {
    return;
  }

  drag_started = false;
  render_update();
  e.preventDefault();
}
window.addEventListener('mouseup', gesture_end, false);
window.addEventListener('touchend', gesture_end, false);
document.body.addEventListener('touchend', (e) => {
  if (e.target === preview_canvas) {
    e.preventDefault();
  }
}, false);

function submit() {
  if (drag_started) {
    return;
  }
  if (movements.length > 0) {
    window.EmbedsAPI.Static.replyAttachment(`${window.location.href}&movements=${movements.join(',')}`);
  }
}

let preview_queued = preview_state && preview_state.length > 0;

const gl_preview = preview_canvas.getContext('webgl');
gl_preview.clearColor(1.0, 1.0, 1.0, 1.0);
gl_preview.blendFunc(gl_preview.SRC_ALPHA, gl_preview.ONE_MINUS_SRC_ALPHA);
gl_preview.enable(gl_preview.BLEND);

let initialized = false;

function render_update() {
  if (!initialized) {
    return;
  }

  gl_preview.clear(gl_preview.COLOR_BUFFER_BIT);
  gl_preview.viewport(0, 0, back_width, orb_width * orbs_height);

  let index = 0;
  let x = 0;
  let y = 0;
  let deferred = null;
  for (let i = 0; i !== orbs_height; i += 1) {
    for (let j = 0; j !== orbs_width; j += 1) {
      if (grid[i][j]) {
        if ((start || drag_started) && i === coord_y && j === coord_x) {
          deferred = () => draw_calls[grid[i][j]](mouse_x - Math.floor(orb_width / 2), mouse_y - Math.floor(orb_width / 2));
        } else {
          draw_calls[grid[i][j]](x, y);
        }
      }
      x += orb_width;
      index += 1;
    }
    x = 0;
    y += orb_width;
  }
  if (deferred) {
    deferred();
  }
}


let orbs_loaded = false;
function render_preview() {
  if (!orbs_loaded) {
    preview_queued = true;
    return;
  }

  initialized = true;

  preview_canvas.width = back_width;
  preview_canvas.height = orb_width * orbs_height;

  preview_queued = false;

  gl_preview.clear(gl_preview.COLOR_BUFFER_BIT);
  gl_preview.viewport(0, 0, back_width, orb_width * orbs_height);

  if (preview_state.length < orbs_height * orbs_width) {
    return;
  }

  let index = 0;
  let x = 0;
  let y = 0;
  for (let i = 0; i !== orbs_height; i += 1) {
    for (let j = 0; j !== orbs_width; j += 1) {
      if (preview_state[index]) {
        draw_calls[preview_state[index]](x, y);
      }
      x += orb_width;
      index += 1;
    }
    x = 0;
    y += orb_width;
  }
}

const orb_images = {};

let orb_images_loaded = 0;
function load_orb_images() {
  Object.keys(types).forEach((type) => {
    const image = new Image();
    image.src = `orbs/${type}.png`;
    image.onload = function () {
      orb_images[type] = image;
      orb_images_loaded += 1;

      back_width = window.innerWidth - 30;
      orb_width = Math.floor(back_width / orbs_width);
      preview_queued = true;
      init_orbs();
    };
  });
}
load_orb_images();

function init_orbs() {
  if (orb_images_loaded !== Object.keys(types).length) {
    return;
  }

  Object.keys(types).forEach((type) => {
    draw_calls[type] = initImage(gl_preview, orb_images[type], orb_width, orb_width, orb_width * orbs_width, orb_width * orbs_height);
  });

  orbs_loaded = true;

  if (preview_queued) {
    render_preview();
    if (!expanded) {
      loop();
    }
  }
}

function expand() {
  window.EmbedsAPI.Static.presentFullscreen(window.location.href);
}

// log_div.innerHTML = `window: ${window.innerWidth}`;
window.onresize = function (e) {
  // log_div.innerHTML = `window: ${window.innerWidth}`;
  initialized = false;
  orbs_loaded = false;
  back_width = window.innerWidth - 30;
  orb_width = Math.floor(back_width / orbs_width);
  preview_queued = true;
  init_orbs();
};
