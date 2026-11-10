const dialog = document.getElementById('garden-dialog');
const infoButton = document.getElementById('info-button');

infoButton?.addEventListener('click', () => dialog?.showModal());

dialog?.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
});
