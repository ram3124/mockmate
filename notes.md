## server.js
- Entry point of the backend
- Loads env variables FIRST before anything else
- express-async-errors removes need for try/catch in every controller
- CORS allows React (port 5173) to talk to Express (port 5000)
- Server only starts AFTER MongoDB connects successfully
- Error handler registered LAST — this is intentional



message: "No active session found."session: nullsuccess: true[[Prototype]]: Object
fetch("http://localhost:5000/api/questions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + localStorage.getItem("mockmate_token")
  },
  body: JSON.stringify({
    text: "Explain the difference between a process and a thread.",
    company: "Google",
    type: "CoreCS",
    difficulty: "Medium",
    topic: "Operating Systems",
    keyPoints: [
      "Definition of process",
      "Definition of thread",
      "Memory sharing",
      "Context switching"
    ],
    modelAnswer: "A process is an independent program with its own memory space, while a thread is the smallest unit of execution within a process and shares the process memory.",
    timeLimit: 300
  })
})
.then(async (res) => {
  const data = await res.json();
  console.log("Status:", res.status);
  console.log("Response:", data);
})
.catch(console.error);
Promise {<pending>}
VM75:25 Status: 403
VM75:26 Response: {success: false, message: 'Access denied. Insufficient permissions.'}message: "Access denied. Insufficient permissions."success: false[[Prototype]]: Object
fetch("http://localhost:5000/api/auth/login", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    email: "admin@gmail.com",
    password: "12345678"
  })
})
.then(async (res) => {
  const data = await res.json();

  console.log("Status:", res.status);
  console.log("Response:", data);

  if (res.ok && data.token) {
    localStorage.setItem("mockmate_token", data.token);
    localStorage.setItem("mockmate_user", JSON.stringify(data.user));

    console.log("✅ Admin logged in successfully.");
    console.log("Current User:", data.user);
  }
})
.catch(console.error);
Promise {<pending>}
VM79:14 Status: 401
VM79:15 Response: {success: false, message: 'Invalid credentials'}
fetch("http://localhost:5000/api/auth/register", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    name: "Admin",
    email: "admin@gmail.com",
    password: "12345678",
    role: "admin"
  })
})
.then(async (res) => {
  console.log("Status:", res.status);
  console.log(await res.json());
});
Promise {<pending>}
VM83:14 Status: 201
VM83:15 {success: true, token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiO…TY1fQ.41AzcBn593xbsZwkWDrmphcOU12MbKTMIDTNDYxbbvU', user: {…}}
fetch("http://localhost:5000/api/auth/login", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    email: "admin@gmail.com",
    password: "12345678"
  })
})
.then(async (res) => {
  const data = await res.json();

  console.log("Status:", res.status);
  console.log("Response:", data);

  if (res.ok && data.token) {
    localStorage.setItem("mockmate_token", data.token);
    localStorage.setItem("mockmate_user", JSON.stringify(data.user));

    console.log("✅ Admin logged in successfully.");
    console.log("Current User:", data.user);
  }
})
.catch(console.error);
Promise {<pending>}
VM87:14 Status: 200
VM87:15 Response: {success: true, token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiO…TczfQ.Fosxik9-Ppf95jhZCgpNL46hZRw-cSaFTaymga36Bak', user: {…}}success: truetoken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2YTQ1MzI1NTMwYmQzM2EwM2Y5OTQ5ZmMiLCJlbWFpbCI6ImFkbWluQGdtYWlsLmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc4MjkxOTc3MywiZXhwIjoxNzgzNTI0NTczfQ.Fosxik9-Ppf95jhZCgpNL46hZRw-cSaFTaymga36Bak"user: {id: '6a45325530bd33a03f9949fc', name: 'Admin', email: 'admin@gmail.com', role: 'admin'}[[Prototype]]: Object
VM87:21 ✅ Admin logged in successfully.
VM87:22 Current User: {id: '6a45325530bd33a03f9949fc', name: 'Admin', email: 'admin@gmail.com', role: 'admin'}
fetch("http://localhost:5000/api/auth/me", {
  headers: {
    Authorization: "Bearer " + localStorage.getItem("mockmate_token")
  }
})
.then(async (res) => {
  console.log("Status:", res.status);
  console.log(await res.json());
});
Promise {<pending>}
VM91:7 Status: 200
VM91:8 {success: true, user: {…}}
fetch("http://localhost:5000/api/questions", {
  method: "GET",
  headers: {
    Authorization: "Bearer " + localStorage.getItem("mockmate_token")
  }
})
.then(async (res) => {
  const data = await res.json();

  console.log("Status:", res.status);
  console.log("Response:", data);
})
.catch(console.error);
Promise {<pending>}
VM95:10 Status: 200
VM95:11 Response: {success: true, totalMatched: 30, count: 10, questions: Array(10)}
fetch("http://localhost:5000/api/questions", {
  method: "GET",
  headers: {
    Authorization: "Bearer " + localStorage.getItem("mockmate_token")
  }
})
.then(async (res) => {
  console.log("Status:", res.status);
  console.log(await res.json());
});
Promise {<pending>}
VM99:8 Status: 200
VM99:9 {success: true, totalMatched: 30, count: 10, questions: Array(10)}count: 10questions: Array(10)0: {_id: '6a4372d12a51c49c70b6c799', text: 'Tell me about a time when you had to lead a team t… What was your approach and what was the outcome?', company: 'General', type: 'HR', difficulty: 'Medium', …}1: {_id: '6a4372d12a51c49c70b6c78a', text: 'Given a string, find the length of the longest sub…ng window technique used in the optimal solution.', company: 'Google', type: 'DSA', difficulty: 'Medium', …}2: {_id: '6a4372d12a51c49c70b6c78c', text: 'Given a matrix of 0s and 1s, find the number of is… or vertically). Explain your traversal strategy.', company: 'Flipkart', type: 'DSA', difficulty: 'Medium', …}3: {_id: '6a4372d12a51c49c70b6c79d', text: 'How do you prioritize tasks when you have multiple…time management approach with a specific example.', company: 'General', type: 'HR', difficulty: 'Easy', …}4: {_id: '6a4372d12a51c49c70b6c789', text: 'Design an algorithm to detect a cycle in a directe…ther methods and discuss their time complexities.', company: 'Flipkart', type: 'DSA', difficulty: 'Medium', …}5: {_id: '6a4372d12a51c49c70b6c788', text: 'Solve the longest common subsequence problem for t…n, and how to reconstruct the actual subsequence.', company: 'Amazon', type: 'DSA', difficulty: 'Hard', …}6: {_id: '6a4372d12a51c49c70b6c787', text: 'Given a binary tree, write a function to determine…e (BST). What constraints must each node satisfy?', company: 'Google', type: 'DSA', difficulty: 'Medium', …}7: {_id: '6a4372d12a51c49c70b6c791', text: 'Explain normalization in databases up to Third Nor… a denormalized table is decomposed step by step.', company: 'TCS', type: 'CoreCS', difficulty: 'Medium', …}8: {_id: '6a4372d12a51c49c70b6c78b', text: 'Implement a function to find the kth largest eleme…min-heap approach with the quickselect algorithm.', company: 'Amazon', type: 'DSA', difficulty: 'Medium', …}9: {_id: '6a4372d12a51c49c70b6c78e', text: 'Design a data structure that supports insert, dele…n why a combination of data structures is needed.', company: 'Google', type: 'DSA', difficulty: 'Hard', …}length: 10[[Prototype]]: Array(0)success: truetotalMatched: 30[[Prototype]]: Object
fetch("http://localhost:5000/api/questions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer " + localStorage.getItem("mockmate_token")
  },
  body: JSON.stringify({
    text: "Explain the difference between Process and Thread.",
    company: "Google",
    type: "CoreCS",
    difficulty: "Medium",
    topic: "Operating Systems",
    keyPoints: [
      "Definition of process",
      "Definition of thread",
      "Memory sharing",
      "Context switching"
    ],
    modelAnswer: "A process is an independent program with its own memory space, whereas a thread is the smallest unit of execution within a process and shares the process memory.",
    timeLimit: 300
  })
})
.then(async (res) => {
  console.log("Status:", res.status);
  console.log(await res.json());
});
Promise {<pending>}
VM103:24 Status: 500
VM103:25 {success: false, message: 'next is not a function'}