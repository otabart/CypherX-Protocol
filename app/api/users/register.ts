fetch('/api/users/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.success) {
        // Account created successfully
      } else {
        alert(data.error || 'Error creating account.');
      }
    })
    .catch((err) => {
      console.error(err);
      alert('Error creating account.');
    });
  

