// HTMX para navegación SPA-like y acciones AJAX
(function() {
  // Mostrar spinner en peticiones
  document.body.addEventListener('htmx:configRequest', function(evt) {
    document.body.classList.add('htmx-loading');
  });
  document.body.addEventListener('htmx:afterSwap', function(evt) {
    document.body.classList.remove('htmx-loading');
  });
  // Feedback de éxito/error
  document.body.addEventListener('htmx:afterRequest', function(evt) {
    if (evt.detail.xhr.status >= 400) {
      alert('Ocurrió un error al procesar la acción.');
    }
  });
})();
