const preview_canvas = document.getElementById("preview");

preview_state = [];

const tolerance = 20;

const gl_preview = preview_canvas.getContext('webgl');
gl_preview.clearColor(0.0, 1.0, 0.0, 1.0);

function render_preview() {
  gl_preview.clear(gl_preview.COLOR_BUFFER_BIT);
  gl_preview.viewport(0, 0, back_width, orb_width * 5);

  let index = 0;
  let x = 0;
  let y = 0;
  for (let i = 0; i !== 5; i += 1) {
    for (let j = 0; j !== 6; j += 1) {
      draw_calls[preview_state[index]](x, y);
      x += orb_width;
      index += 1;
    }
    x = 0;
    y += orb_width;
  }
  render();
}


function init_orbs() {
  const types = ['light', 'dark', 'fire', 'wood', 'water', 'heart'];
  types.forEach((type) => {
    const image = new Image();
    image.src = `orbs/${type}.png`;
    image.onload = function () {
      draw_calls[type] = initImage(gl_preview, image, orb_width, orb_width, orb_width * 6, orb_width * 5);
    };
  });
}
init_orbs();


