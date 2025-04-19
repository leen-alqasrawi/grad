    function showInfo(id) {
    const boxes = document.querySelectorAll('.info-box');
    boxes.forEach(box => box.style.display = 'none');  // إخفاء كل الأقسام
    
    const selectedBox = document.getElementById(id);
    if (selectedBox) {
      selectedBox.style.display = 'block';  // إظهار القسم الذي يتم اختياره
    }
  }
  
  // إظهار "education" بشكل افتراضي عند تحميل الصفحة
  window.onload = function() {
    showInfo('education');  // يعرض قسم "Best Education" عند تحميل الصفحة
  };
  