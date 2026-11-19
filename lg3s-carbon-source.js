(async function () {
  const program = document.getElementById('program');
  const token = location.hash.slice(1);

  try {
    if (!token) throw new Error('Use the link generated in the GBR Desk.');
    const response = await fetch('/lg3s-gb/arena/open-program', {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Generate a fresh link in the GBR Desk.');
    program.src = '/lg3s-gb/arena/broadcast.html?follow=desk';
  } catch (error) {
    console.warn('Carbon Arena Browser Source:', error.message);
    program.src = '/lg3s-gb?mode=obs';
  }
})();
