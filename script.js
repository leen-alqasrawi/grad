// Hide all info boxes first, show only the selected one
function scrollAndShow(id) {
  const boxes = document.querySelectorAll('.info-box');
  boxes.forEach(box => {
    box.style.display = 'none';
  });

  const selected = document.getElementById(id);
  if (selected) {
    selected.style.display = 'block';
    selected.scrollIntoView({ behavior: 'smooth' });
  }
}

///////////////////////////

document.addEventListener('DOMContentLoaded', function () {
  const buttons = document.querySelectorAll('.tab-buttons button');
  const contents = document.querySelectorAll('.tab-content');

  buttons.forEach(button => {
    button.addEventListener('click', function () {
      const tabId = this.getAttribute('data-tab');

      contents.forEach(content => content.classList.remove('active'));
      buttons.forEach(btn => btn.classList.remove('active'));

      document.getElementById(tabId).classList.add('active');
      this.classList.add('active');
    });
  });
});
