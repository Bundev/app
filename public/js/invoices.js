// Копируеть текст при клике на элемент с классом .invoices-item
document.addEventListener('click', (e) => {

  const product = e.target.closest('.invoices-item');
  if (!product) return;
  const text = product.dataset.name;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
  
 
  // console.log('Скопировано:', text);
});

