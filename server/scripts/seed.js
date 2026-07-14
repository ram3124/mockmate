/**
 * Seed Script — Populates the questions collection with 30 realistic interview
 * questions across DSA, Core CS, and HR categories.
 *
 * Usage:  npm run seed
 *         node scripts/seedQuestions.js
 *
 * This script:
 *   1. Connects to MongoDB via the shared config/db.js module
 *   2. Logs and clears any existing questions
 *   3. Inserts 30 curated questions (10 DSA, 10 CoreCS, 10 HR)
 *   4. Prints a verification summary grouped by company and type
 *   5. Disconnects and exits with proper exit codes
 */

// Load env vars — required for MONGO_URI
require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Question = require('../models/Question');

// =============================================================================
// Seed Data — 30 realistic interview questions
// =============================================================================

const seedQuestions = [
  // ─────────────────────────────────────────────────────────────────────────
  // DSA Questions (10) — tagged for Google, Amazon, Flipkart
  // ─────────────────────────────────────────────────────────────────────────
  {
    text: 'Given an array of integers, find two numbers such that they add up to a specific target. What is the most efficient approach and its time complexity?',
    company: 'Google',
    type: 'DSA',
    difficulty: 'Easy',
    topic: 'Arrays',
    keyPoints: [
      'Hash map approach for O(n) time complexity',
      'Trade-off between brute force O(n²) and hash map O(n)',
      'Handling duplicate values in the array',
      'Single-pass vs two-pass hash map solutions',
    ],
    modelAnswer:
      'The optimal approach uses a hash map to store each number and its index as you iterate through the array. For each element, check if the complement (target minus current number) exists in the map. This gives O(n) time and O(n) space complexity. The brute force alternative with nested loops runs in O(n²) which is impractical for large inputs. Edge cases include handling duplicates and ensuring you do not reuse the same element index twice.',
    timeLimit: 300,
  },
  {
    text: 'Explain how you would reverse a singly linked list both iteratively and recursively. Discuss the space complexity differences between the two approaches.',
    company: 'Amazon',
    type: 'DSA',
    difficulty: 'Easy',
    topic: 'Linked Lists',
    keyPoints: [
      'Iterative approach using three pointers: prev, current, next',
      'Recursive approach by reversing the rest and adjusting pointers',
      'Iterative uses O(1) space while recursive uses O(n) stack space',
      'Handling edge cases: empty list and single-node list',
    ],
    modelAnswer:
      'The iterative approach maintains three pointers — previous, current, and next. At each step you save the next node, point current.next to previous, then advance previous and current forward. This runs in O(n) time and O(1) space. The recursive approach processes the rest of the list first, then adjusts pointers on the way back up the call stack. While also O(n) time, it uses O(n) space due to recursive call frames. For production code, the iterative version is preferred because it avoids potential stack overflow on very long lists.',
    timeLimit: 300,
  },
  {
    text: 'Given a binary tree, write a function to determine if it is a valid Binary Search Tree (BST). What constraints must each node satisfy?',
    company: 'Google',
    type: 'DSA',
    difficulty: 'Medium',
    topic: 'Trees',
    keyPoints: [
      'In-order traversal should yield sorted values',
      'Each node must satisfy min/max range constraints from ancestors',
      'Common mistake: only comparing with immediate parent',
      'Using Integer.MIN_VALUE/MAX_VALUE as initial bounds',
      'Handling duplicate values depending on BST definition',
    ],
    modelAnswer:
      'A valid BST requires every node in the left subtree to be strictly less than the root, and every node in the right subtree to be strictly greater. The correct approach passes down min and max bounds through recursion. At each node, verify the value is within the allowed range, then recurse on the left child with an updated upper bound and the right child with an updated lower bound. Simply comparing a node with its direct parent is insufficient because a deep node could violate an ancestor constraint. An alternative is in-order traversal: if the resulting sequence is strictly increasing, the tree is a valid BST.',
    timeLimit: 420,
  },
  {
    text: 'Solve the longest common subsequence problem for two strings. Explain the dynamic programming approach, state transition, and how to reconstruct the actual subsequence.',
    company: 'Amazon',
    type: 'DSA',
    difficulty: 'Hard',
    topic: 'Dynamic Programming',
    keyPoints: [
      'DP table where dp[i][j] represents LCS of first i and j characters',
      'State transition: match case vs mismatch case',
      'Time complexity O(m*n) and space complexity O(m*n) with optimization to O(min(m,n))',
      'Backtracking through the DP table to reconstruct the subsequence',
      'Difference between subsequence and substring problems',
    ],
    modelAnswer:
      'Build a 2D table dp where dp[i][j] stores the length of the longest common subsequence of the first i characters of string A and the first j characters of string B. If A[i-1] equals B[j-1], then dp[i][j] = dp[i-1][j-1] + 1 because we extend the previous LCS. Otherwise dp[i][j] = max(dp[i-1][j], dp[i][j-1]) because we skip one character from either string. To reconstruct the actual subsequence, start from dp[m][n] and trace back: if the characters match move diagonally; otherwise move in the direction of the larger value. The time and space complexity are both O(m*n), though space can be optimized to O(min(m,n)) if only the length is needed.',
    timeLimit: 600,
  },
  {
    text: 'Design an algorithm to detect a cycle in a directed graph. Compare DFS-based approaches with other methods and discuss their time complexities.',
    company: 'Flipkart',
    type: 'DSA',
    difficulty: 'Medium',
    topic: 'Graphs',
    keyPoints: [
      'DFS with three coloring states: white (unvisited), gray (in progress), black (done)',
      'Cycle exists if a gray node encounters another gray node',
      'Kahn algorithm (BFS topological sort) as an alternative — cycle if not all nodes processed',
      'Time complexity O(V+E) for both approaches',
    ],
    modelAnswer:
      'The standard approach uses DFS with a three-color marking system. Nodes start as white (unvisited). When DFS enters a node it marks it gray (currently being processed). When all descendants are fully explored it marks the node black. A cycle is detected when DFS encounters a gray node from another gray node — this means we have found a back edge. An alternative is Kahn algorithm for topological sorting using BFS: compute in-degrees, process zero-in-degree nodes, and if the count of processed nodes is less than total nodes, a cycle exists. Both run in O(V+E) time. The DFS approach is typically preferred for its simplicity and lower constant factor.',
    timeLimit: 480,
  },
  {
    text: 'Given a string, find the length of the longest substring without repeating characters. Explain the sliding window technique used in the optimal solution.',
    company: 'Google',
    type: 'DSA',
    difficulty: 'Medium',
    topic: 'Strings',
    keyPoints: [
      'Sliding window with two pointers maintaining a valid window',
      'Hash set or hash map to track characters in current window',
      'Moving left pointer to shrink window when duplicate found',
      'O(n) time complexity with single traversal',
      'Comparison with brute force O(n³) approach',
    ],
    modelAnswer:
      'Use the sliding window technique with two pointers — left and right — that define the current window of unique characters. Maintain a hash set containing characters in the window. Expand the window by moving right forward. When a duplicate is encountered, shrink the window from the left by removing characters until the duplicate is gone. Track the maximum window size throughout this process. This achieves O(n) time because each character is added and removed from the set at most once. The brute force approach of checking all substrings runs in O(n³) which is impractical for large strings.',
    timeLimit: 300,
  },
  {
    text: 'Implement a function to find the kth largest element in an unsorted array. Compare the min-heap approach with the quickselect algorithm.',
    company: 'Amazon',
    type: 'DSA',
    difficulty: 'Medium',
    topic: 'Arrays',
    keyPoints: [
      'Min-heap of size k gives O(n log k) time',
      'Quickselect (modified quicksort partition) gives average O(n) time',
      'Worst case of quickselect is O(n²) without randomization',
      'Sorting approach is O(n log n) — simple but not optimal',
      'Space considerations: heap uses O(k) vs quickselect uses O(1)',
    ],
    modelAnswer:
      'Two efficient approaches exist. First, maintain a min-heap of size k: iterate through the array and push each element; when the heap exceeds k elements, pop the minimum. After processing all elements, the heap top is the kth largest. This runs in O(n log k) time and O(k) space. Second, quickselect works by partitioning the array around a pivot. If the pivot lands at position n-k, we found the answer. Otherwise recurse on the appropriate side. Average case is O(n) but worst case is O(n²). Using random pivot selection or median-of-medians guarantees O(n) worst case. For most practical cases, quickselect is faster but the heap approach is more predictable.',
    timeLimit: 420,
  },
  {
    text: 'Given a matrix of 0s and 1s, find the number of islands. An island is a group of connected 1s (horizontally or vertically). Explain your traversal strategy.',
    company: 'Flipkart',
    type: 'DSA',
    difficulty: 'Medium',
    topic: 'Graphs',
    keyPoints: [
      'BFS or DFS traversal from each unvisited 1-cell',
      'Marking visited cells to avoid counting the same island twice',
      'Handling grid boundaries during neighbor exploration',
      'Time complexity O(rows × cols) since each cell visited once',
      'Union-Find as an alternative approach for connected components',
    ],
    modelAnswer:
      'Iterate through every cell in the matrix. When you find an unvisited cell with value 1, increment the island count and trigger a BFS or DFS to mark all connected 1-cells as visited. BFS uses a queue and explores neighbors level by level, while DFS uses recursion or a stack. In both cases, check all four directions (up, down, left, right) and ensure you stay within grid bounds. Each cell is visited at most once, giving O(rows × cols) time complexity. The visited state can be tracked by modifying the input matrix (setting 1 to 0) or using a separate visited set. Union-Find is an alternative that processes cells and unions adjacent 1-cells, counting distinct components at the end.',
    timeLimit: 420,
  },
  {
    text: 'Explain the merge sort algorithm in detail. Analyze its time complexity in best, average, and worst cases, and discuss when it is preferred over quicksort.',
    company: 'Flipkart',
    type: 'DSA',
    difficulty: 'Easy',
    topic: 'Sorting',
    keyPoints: [
      'Divide-and-conquer: split array in half, recursively sort, merge',
      'Consistent O(n log n) time in all cases — no worst-case degradation',
      'O(n) auxiliary space required for merging',
      'Stable sort — preserves relative order of equal elements',
      'Preferred over quicksort for linked lists and external sorting',
    ],
    modelAnswer:
      'Merge sort divides the array into two halves, recursively sorts each half, then merges the sorted halves. The merge step compares elements from both halves and writes them in order into a temporary array. Time complexity is O(n log n) in all cases — best, average, and worst — because the array is always split in half regardless of input order. This contrasts with quicksort whose worst case is O(n²). However, merge sort requires O(n) extra space for the temporary array during merging. Merge sort is preferred when stability is required, for sorting linked lists (where pointer manipulation avoids extra space), and for external sorting where sequential access patterns are important.',
    timeLimit: 300,
  },
  {
    text: 'Design a data structure that supports insert, delete, and getRandom in O(1) average time. Explain why a combination of data structures is needed.',
    company: 'Google',
    type: 'DSA',
    difficulty: 'Hard',
    topic: 'Data Structures',
    keyPoints: [
      'Combination of dynamic array and hash map',
      'Array enables O(1) random access for getRandom',
      'Hash map enables O(1) lookup for insert and delete existence checks',
      'Delete strategy: swap with last element to avoid shifting',
      'Trade-off: sacrifices ordering for O(1) performance',
    ],
    modelAnswer:
      'Use an array list combined with a hash map. The array stores the elements, and the hash map stores each element mapped to its index in the array. Insert appends to the array and records the index in the map — both O(1). For getRandom, generate a random index and return the array element — O(1) since arrays support random access. Delete is the key insight: look up the element index from the map, swap it with the last element in the array, update the swapped element index in the map, then pop the last element and remove the deleted element from the map. All operations are O(1). A hash set alone cannot support O(1) getRandom because there is no random index access.',
    timeLimit: 480,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Core CS Questions (10) — tagged for TCS, Infosys, General
  // ─────────────────────────────────────────────────────────────────────────
  {
    text: 'Explain the differences between process and thread. When would you choose multithreading over multiprocessing in a software application?',
    company: 'TCS',
    type: 'CoreCS',
    difficulty: 'Easy',
    topic: 'Operating Systems',
    keyPoints: [
      'Process has its own memory space; threads share memory within a process',
      'Context switching is faster between threads than between processes',
      'Threads share heap but have separate stacks',
      'Multiprocessing provides better fault isolation',
      'Multithreading is preferred for I/O-bound tasks with shared state',
    ],
    modelAnswer:
      'A process is an independent execution unit with its own memory space, file descriptors, and system resources. A thread is a lightweight execution unit within a process that shares the same memory space and resources with other threads. Context switching between threads is faster because there is no need to switch memory maps. Choose multithreading when tasks need to share data frequently and are I/O-bound, such as handling multiple network connections. Choose multiprocessing when tasks are CPU-bound and benefit from true parallelism, or when fault isolation is important because a crash in one process does not affect others.',
    timeLimit: 300,
  },
  {
    text: 'What is a deadlock? Explain the four necessary conditions for deadlock (Coffman conditions) and describe at least two strategies to prevent it.',
    company: 'Infosys',
    type: 'CoreCS',
    difficulty: 'Medium',
    topic: 'Operating Systems',
    keyPoints: [
      'Four conditions: mutual exclusion, hold and wait, no preemption, circular wait',
      'All four must hold simultaneously for deadlock',
      'Prevention by breaking circular wait with resource ordering',
      'Prevention by breaking hold-and-wait by requesting all resources upfront',
      'Detection vs prevention trade-offs in real systems',
    ],
    modelAnswer:
      'A deadlock occurs when two or more processes are blocked forever, each waiting for a resource held by another. The four Coffman conditions are: mutual exclusion (resources cannot be shared), hold and wait (a process holds one resource while waiting for another), no preemption (resources cannot be forcibly taken), and circular wait (a circular chain of processes each waiting for a resource held by the next). To prevent deadlock, break at least one condition. Resource ordering eliminates circular wait by requiring processes to request resources in a fixed order. Requiring all resources upfront eliminates hold and wait but reduces concurrency. In practice, many systems use deadlock detection with timeout-based recovery rather than strict prevention.',
    timeLimit: 420,
  },
  {
    text: 'Explain normalization in databases up to Third Normal Form (3NF). Give a practical example showing how a denormalized table is decomposed step by step.',
    company: 'TCS',
    type: 'CoreCS',
    difficulty: 'Medium',
    topic: 'DBMS',
    keyPoints: [
      '1NF: eliminate repeating groups, ensure atomic values',
      '2NF: remove partial dependencies on composite keys',
      '3NF: remove transitive dependencies on non-key attributes',
      'Each step reduces data redundancy and update anomalies',
      'Trade-off between normalization and query performance',
    ],
    modelAnswer:
      'Normalization organizes relational data to reduce redundancy. First Normal Form (1NF) requires atomic column values and no repeating groups — for example, splitting a comma-separated "phone numbers" column into separate rows. Second Normal Form (2NF) removes partial dependencies: if a table has a composite primary key, every non-key column must depend on the entire key, not just part of it. Third Normal Form (3NF) removes transitive dependencies: no non-key column should depend on another non-key column. For example, if an Orders table stores customer_name and customer_city, the city depends on the customer rather than the order — this should be moved to a separate Customers table. Over-normalization can hurt read performance, so denormalization is sometimes applied deliberately for frequently joined queries.',
    timeLimit: 420,
  },
  {
    text: 'What are ACID properties in database transactions? Explain each property and describe what happens when one of them is violated.',
    company: 'Infosys',
    type: 'CoreCS',
    difficulty: 'Easy',
    topic: 'DBMS',
    keyPoints: [
      'Atomicity: all-or-nothing execution of transactions',
      'Consistency: database moves from one valid state to another',
      'Isolation: concurrent transactions do not interfere with each other',
      'Durability: committed data survives system crashes',
      'Isolation levels trade consistency for performance',
    ],
    modelAnswer:
      'ACID stands for Atomicity, Consistency, Isolation, and Durability. Atomicity ensures that either all operations in a transaction complete or none do — if a bank transfer debits one account but the credit fails, the debit is rolled back. Consistency guarantees that a transaction moves the database from one valid state to another, respecting all constraints and triggers. Isolation ensures that concurrent transactions appear to execute serially, preventing issues like dirty reads or phantom reads. Durability means that once a transaction is committed, the changes persist even if the system crashes immediately after. Violating isolation can cause data corruption in concurrent systems; violating atomicity can leave the database in an inconsistent state with partial updates.',
    timeLimit: 300,
  },
  {
    text: 'Explain the TCP three-way handshake process in detail. Why is a three-way handshake necessary instead of a two-way handshake?',
    company: 'General',
    type: 'CoreCS',
    difficulty: 'Easy',
    topic: 'Computer Networks',
    keyPoints: [
      'SYN from client, SYN-ACK from server, ACK from client',
      'Each side must confirm both its sending and receiving capabilities',
      'Sequence numbers are exchanged for reliable data ordering',
      'Two-way handshake cannot confirm that the server can receive client ACKs',
      'Protection against old duplicate connection requests',
    ],
    modelAnswer:
      'The TCP three-way handshake establishes a reliable connection. First, the client sends a SYN segment with an initial sequence number. Second, the server responds with SYN-ACK, acknowledging the client sequence number and providing its own. Third, the client sends an ACK confirming the server sequence number. A two-way handshake would only confirm that the client can reach the server and the server can respond, but it would not confirm that the server can receive acknowledgments from the client. The three-way process also prevents old duplicate SYN packets from establishing ghost connections, because the client will not ACK a SYN-ACK that does not match an active connection attempt. This ensures both sides agree on sequence numbers before data transfer begins.',
    timeLimit: 300,
  },
  {
    text: 'What is the difference between HTTP and HTTPS? Explain how TLS/SSL encryption works at a high level and why it is essential for web security.',
    company: 'General',
    type: 'CoreCS',
    difficulty: 'Easy',
    topic: 'Computer Networks',
    keyPoints: [
      'HTTPS adds TLS/SSL encryption layer on top of HTTP',
      'TLS handshake establishes symmetric encryption using asymmetric key exchange',
      'Server presents a certificate signed by a trusted Certificate Authority',
      'Prevents man-in-the-middle attacks and eavesdropping',
      'Performance overhead of encryption is negligible with modern hardware',
    ],
    modelAnswer:
      'HTTP transmits data in plaintext, making it vulnerable to eavesdropping and man-in-the-middle attacks. HTTPS wraps HTTP inside a TLS (Transport Layer Security) encryption layer. During the TLS handshake, the server presents its digital certificate (signed by a Certificate Authority) to prove its identity. The client and server then negotiate a shared symmetric encryption key using asymmetric cryptography — the server public key encrypts a pre-master secret that only the server private key can decrypt. All subsequent data is encrypted with the symmetric key for performance. This ensures confidentiality (data cannot be read), integrity (data cannot be altered), and authentication (the server is who it claims to be). Modern hardware makes the encryption overhead negligible.',
    timeLimit: 300,
  },
  {
    text: 'Explain the four pillars of Object-Oriented Programming with practical examples. How does each principle contribute to writing maintainable code?',
    company: 'TCS',
    type: 'CoreCS',
    difficulty: 'Easy',
    topic: 'OOP',
    keyPoints: [
      'Encapsulation: bundling data and methods, hiding internal state',
      'Abstraction: exposing essential features while hiding implementation details',
      'Inheritance: deriving new classes from existing ones for code reuse',
      'Polymorphism: same interface with different underlying behavior',
      'Each pillar reduces coupling and increases cohesion',
    ],
    modelAnswer:
      'The four pillars are Encapsulation, Abstraction, Inheritance, and Polymorphism. Encapsulation bundles data with the methods that operate on it and restricts direct access through access modifiers — for example, a BankAccount class hides the balance field and exposes deposit/withdraw methods. Abstraction hides complexity behind simple interfaces — a database connection class exposes query methods without revealing socket management. Inheritance lets a SavingsAccount class extend BankAccount, reusing common behavior while adding interest calculation. Polymorphism allows a single method name to behave differently depending on the object type — a draw() method renders different shapes appropriately. Together, these principles produce code that is modular, reusable, and easier to maintain because changes in one component have minimal impact on others.',
    timeLimit: 300,
  },
  {
    text: 'Explain virtual memory and how paging works in modern operating systems. What is a page fault and how does the OS handle it?',
    company: 'Infosys',
    type: 'CoreCS',
    difficulty: 'Medium',
    topic: 'Operating Systems',
    keyPoints: [
      'Virtual memory provides each process an illusion of contiguous private memory',
      'Paging divides virtual and physical memory into fixed-size pages and frames',
      'Page table maps virtual page numbers to physical frame numbers',
      'Page fault occurs when accessed page is not in physical memory',
      'OS handles page fault by loading the page from disk into a free frame',
    ],
    modelAnswer:
      'Virtual memory allows processes to use more memory than physically available by abstracting physical memory into virtual address spaces. Paging divides both virtual memory and physical memory into fixed-size blocks called pages and frames respectively. The page table maintained by the OS maps each virtual page to a physical frame. When a process accesses a memory address, the MMU translates it using the page table. A page fault occurs when the requested page is not currently loaded in physical memory. The OS handles this by suspending the process, finding a free frame (or evicting a page using algorithms like LRU), loading the requested page from the swap space on disk, updating the page table, and resuming the process. Excessive page faults lead to thrashing, where the system spends more time swapping than executing.',
    timeLimit: 420,
  },
  {
    text: 'What is indexing in databases? Compare B-Tree and Hash indexes, explaining when each type is appropriate and their impact on query performance.',
    company: 'General',
    type: 'CoreCS',
    difficulty: 'Medium',
    topic: 'DBMS',
    keyPoints: [
      'Indexes speed up reads at the cost of slower writes and storage space',
      'B-Tree indexes support range queries, ordering, and prefix matching',
      'Hash indexes only support exact equality lookups',
      'B-Tree indexes are the default in most relational databases',
      'Over-indexing causes write amplification and increased storage',
    ],
    modelAnswer:
      'An index is a data structure that speeds up data retrieval by maintaining a sorted reference to rows. B-Tree indexes organize data in a balanced tree structure, supporting equality lookups, range queries (greater than, less than), ordering, and prefix-based searches. They are the default index type in most databases because of their versatility. Hash indexes use a hash function to map values to buckets, providing O(1) average-time exact lookups but cannot support range queries or sorting. Choose B-Tree for columns used in WHERE clauses with range operators or ORDER BY. Choose Hash for columns used exclusively in exact-match lookups like primary keys. Both index types slow down writes because the index must be updated on every insert, update, or delete, so only index columns that are frequently queried.',
    timeLimit: 420,
  },
  {
    text: 'Explain the concept of DNS resolution. Walk through the complete process from when a user types a URL in the browser to receiving the IP address.',
    company: 'Infosys',
    type: 'CoreCS',
    difficulty: 'Medium',
    topic: 'Computer Networks',
    keyPoints: [
      'Browser cache, OS cache, and router cache checked first',
      'Recursive query sent to configured DNS resolver (ISP or public)',
      'Resolver contacts root, TLD, and authoritative name servers iteratively',
      'Caching at each level with TTL to reduce redundant lookups',
      'DNS uses UDP port 53 for standard queries for speed',
    ],
    modelAnswer:
      'When a user types a URL, the browser first checks its own DNS cache. If not found, it queries the OS resolver cache, then the router cache. If still unresolved, a recursive query is sent to the configured DNS resolver (typically the ISP or a public resolver like 8.8.8.8). The resolver performs iterative queries: it contacts a root name server which directs it to the appropriate TLD (Top-Level Domain) name server (e.g., .com), which in turn directs it to the authoritative name server for the specific domain. The authoritative server returns the IP address. Each response includes a TTL (Time To Live) value, and the resolver caches the result for that duration to speed up future lookups. DNS primarily uses UDP on port 53 because the small query and response sizes fit within a single datagram, avoiding the overhead of TCP connection setup.',
    timeLimit: 360,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // HR / Behavioral Questions (10) — tagged General
  // ─────────────────────────────────────────────────────────────────────────
  {
    text: 'Tell me about a time when you had to lead a team through a challenging project. What was your approach and what was the outcome?',
    company: 'General',
    type: 'HR',
    difficulty: 'Medium',
    topic: 'Leadership',
    keyPoints: [
      'STAR method: Situation, Task, Action, Result',
      'Specific example of a real project with measurable challenge',
      'Evidence of delegation, communication, and decision-making',
      'Quantifiable outcome or lesson learned',
    ],
    modelAnswer:
      'A strong answer uses the STAR framework. Describe a specific situation with clear stakes — for example, leading a team of five to deliver a product feature under a tight two-week deadline. Explain the task and your role as the decision-maker. Detail the actions you took: breaking the project into milestones, assigning tasks based on individual strengths, holding daily standups to track progress, and personally unblocking a critical dependency. Conclude with a measurable result — the feature shipped on time with zero critical bugs, or the client renewed their contract. The interviewer evaluates leadership style, ability to handle pressure, and whether you credit the team.',
    timeLimit: 300,
  },
  {
    text: 'Describe a situation where you had a conflict with a coworker. How did you handle it, and what did you learn from the experience?',
    company: 'General',
    type: 'HR',
    difficulty: 'Medium',
    topic: 'Conflict Resolution',
    keyPoints: [
      'Acknowledge the conflict without blaming the other person',
      'Describe proactive steps taken to resolve the disagreement',
      'Show empathy and willingness to understand the other perspective',
      'Demonstrate a positive outcome or growth from the experience',
    ],
    modelAnswer:
      'Use a real but professional example. Describe a disagreement over a technical decision — for example, you and a colleague disagreed on the database choice for a new service. Explain that you scheduled a one-on-one conversation to understand their perspective, discovered they had valid concerns about scalability that you had not considered, and proposed a compromise: a proof-of-concept comparing both options with benchmarks. The result was a data-driven decision that both parties supported. Emphasize that you learned the importance of listening before defending your position and that constructive conflict often leads to better outcomes than agreement for the sake of harmony.',
    timeLimit: 300,
  },
  {
    text: 'Why do you want to work at this company? What specifically about our products, culture, or mission attracts you?',
    company: 'General',
    type: 'HR',
    difficulty: 'Easy',
    topic: 'Why This Company',
    keyPoints: [
      'Research-backed specifics about the company — not generic praise',
      'Alignment between personal career goals and company mission',
      'Mention a specific product, initiative, or value that resonates',
      'Show enthusiasm without being sycophantic',
    ],
    modelAnswer:
      'A strong answer demonstrates genuine research. Reference a specific product feature, recent initiative, or company value that aligns with your career goals. For example: "I have been following your expansion into AI-powered search and the way your team published research on efficient transformer architectures. My background in NLP and my interest in building user-facing AI tools makes this a natural fit. I am also drawn to your engineering culture of shipping fast and iterating based on user feedback, which matches how I prefer to work." Avoid vague statements like "because you are a great company." The interviewer wants evidence that you understand what the company does and have thought about why you belong there.',
    timeLimit: 300,
  },
  {
    text: 'Tell me about a time you failed at something. How did you recover, and what did you change as a result?',
    company: 'General',
    type: 'HR',
    difficulty: 'Medium',
    topic: 'Self Awareness',
    keyPoints: [
      'Genuine failure — not a disguised success story',
      'Ownership and accountability without deflecting blame',
      'Concrete steps taken to recover and prevent recurrence',
      'Growth mindset — what was learned and applied going forward',
    ],
    modelAnswer:
      'Choose a real failure that shows self-awareness. For example: "I once underestimated the complexity of a database migration and gave an optimistic timeline. The migration caused two hours of downtime. I took responsibility in the post-mortem, created a pre-migration checklist that included load testing and rollback procedures, and now I always add buffer time for infrastructure changes." The key is demonstrating that you own your mistakes, take corrective action, and apply the lesson to future work. Avoid disguising strengths as failures (like "I work too hard") — interviewers see through this and it signals a lack of self-awareness.',
    timeLimit: 300,
  },
  {
    text: 'How do you prioritize tasks when you have multiple urgent deadlines? Describe your time management approach with a specific example.',
    company: 'General',
    type: 'HR',
    difficulty: 'Easy',
    topic: 'Time Management',
    keyPoints: [
      'Framework used: Eisenhower matrix, MoSCoW, or similar prioritization',
      'Communication with stakeholders about trade-offs',
      'Ability to distinguish urgent from important',
      'Delegation as a strategy when appropriate',
      'Specific example with measurable outcome',
    ],
    modelAnswer:
      'Describe a concrete scenario. For example: "During a product launch week, I had a critical bug to fix, a code review to complete, and a presentation to prepare — all due within 48 hours. I used the Eisenhower matrix to categorize: the bug was urgent and important so it came first. The presentation was important but not urgent, so I prepared the outline and delegated the slide formatting to a teammate. The code review was urgent but less impactful, so I timboxed it to 30 minutes. I communicated the re-prioritization to my manager with my reasoning." The interviewer wants to see a systematic approach, not just working longer hours, and evidence that you communicate proactively about trade-offs.',
    timeLimit: 300,
  },
  {
    text: 'Where do you see yourself in five years? How does this role fit into your long-term career plan?',
    company: 'General',
    type: 'HR',
    difficulty: 'Easy',
    topic: 'Career Goals',
    keyPoints: [
      'Realistic and specific career trajectory',
      'Alignment between growth ambitions and what the role offers',
      'Willingness to grow within the company',
      'Balance between ambition and groundedness',
    ],
    modelAnswer:
      'A good answer balances ambition with realism. For example: "In five years I see myself as a senior engineer or technical lead, owning the architecture of a significant system. This role excites me because it offers hands-on experience with distributed systems at scale, which is the technical foundation I need for that trajectory. In the near term, I want to deepen my expertise in backend design and mentoring junior developers. I am specifically interested in growing within a company that invests in its engineers, which is why the learning culture here appeals to me." Avoid answers that imply you will leave quickly ("I want to start my own company") or are too vague ("I just want to be successful").',
    timeLimit: 300,
  },
  {
    text: 'Describe a situation where you had to learn a new technology or skill quickly to complete a project. How did you approach the learning process?',
    company: 'General',
    type: 'HR',
    difficulty: 'Easy',
    topic: 'Adaptability',
    keyPoints: [
      'Specific technology and the business context requiring it',
      'Structured learning approach — not just random googling',
      'Application of the new skill to deliver a tangible result',
      'Time pressure that demonstrates adaptability',
    ],
    modelAnswer:
      'Pick a concrete example. For instance: "When our team decided to migrate from REST to GraphQL, I had no prior experience with it. I dedicated the first two days to reading the official documentation and completing a tutorial project. On day three I paired with a colleague who had GraphQL experience to review my first resolver implementation. Within a week I had converted our three most-used endpoints and documented the migration pattern for the rest of the team." The interviewer evaluates your learning process (structured vs chaotic), whether you leverage available resources like documentation and colleagues, and whether the learning resulted in a tangible deliverable.',
    timeLimit: 300,
  },
  {
    text: 'Give an example of a time you received critical feedback. How did you respond, and did you make any changes as a result?',
    company: 'General',
    type: 'HR',
    difficulty: 'Medium',
    topic: 'Growth Mindset',
    keyPoints: [
      'Specific feedback received — not vague generalities',
      'Initial emotional reaction acknowledged honestly',
      'Constructive response: seeking clarification and taking action',
      'Measurable change or improvement that resulted',
    ],
    modelAnswer:
      'Share a genuine example. For instance: "During a performance review, my manager said my code reviews were too brief and did not catch enough issues. Initially I felt defensive because I thought I was being efficient. But I reflected on it and realized I was prioritizing speed over thoroughness. I changed my approach by creating a personal review checklist covering security, error handling, and test coverage. Over the next quarter, the bugs in code I reviewed dropped by 40 percent, and two teammates told me my reviews helped them improve. I learned that critical feedback, even when uncomfortable, is the fastest path to improvement."',
    timeLimit: 300,
  },
  {
    text: 'How do you handle working under pressure or tight deadlines? Give a specific example where you delivered quality work under time constraints.',
    company: 'General',
    type: 'HR',
    difficulty: 'Easy',
    topic: 'Pressure Handling',
    keyPoints: [
      'Specific high-pressure situation with real stakes',
      'Strategies used: breaking down work, eliminating distractions, seeking help',
      'Quality maintained despite time pressure — not just speed',
      'Reflection on what you would do differently',
    ],
    modelAnswer:
      'Describe a real scenario with measurable constraints. For example: "A client discovered a security vulnerability on a Friday afternoon and needed a patch before Monday. I immediately triaged the issue, identified the root cause as an unvalidated input in our API, and wrote a fix with comprehensive test coverage within three hours. I then coordinated with DevOps for an emergency deployment and wrote a postmortem documenting the root cause and prevention steps. I maintained quality by writing tests first, which actually helped me find a second related vulnerability. Under pressure, I focus on reducing scope to the essential fix, communicating status frequently, and resisting the temptation to cut corners on testing."',
    timeLimit: 300,
  },
  {
    text: 'Tell me about a time you disagreed with your manager about a technical decision. How did you handle the situation?',
    company: 'General',
    type: 'HR',
    difficulty: 'Hard',
    topic: 'Professional Disagreement',
    keyPoints: [
      'Respectful pushback with evidence rather than opinion',
      'Understanding the manager perspective and constraints',
      'Proposing a constructive alternative with data',
      'Accepting the final decision gracefully regardless of outcome',
      'Distinguishing between a hill worth dying on and a preference',
    ],
    modelAnswer:
      'Share a real disagreement that shows professionalism. For example: "My manager wanted to use a third-party analytics service, but I believed we should build a lightweight in-house solution because our data sensitivity requirements made third-party data sharing risky. Instead of arguing in a meeting, I prepared a comparison document with three options: full third-party, hybrid, and in-house — each with cost, timeline, and risk analysis. I presented it one-on-one and we agreed on the hybrid approach that used the third-party service for non-sensitive metrics while keeping sensitive data in-house. I learned that managers often have constraints I do not see, and presenting alternatives with evidence is more effective than just saying no."',
    timeLimit: 360,
  },
];

// =============================================================================
// Main Seed Function
// =============================================================================
const runSeed = async () => {
  try {
    // 1. Connect to MongoDB using the shared connection module
    await connectDB();

    // 2. Log how many existing questions will be removed
    const existingCount = await Question.countDocuments();
    console.log(
      `\n🗑️  Clearing ${existingCount} existing question(s) from the collection...`,
    );

    await Question.deleteMany({});
    console.log('✅  Collection cleared.');

    // 3. Insert the 30 seed questions
    console.log(`\n📝  Inserting ${seedQuestions.length} new questions...`);
    await Question.insertMany(seedQuestions);
    console.log('✅  Questions inserted successfully.\n');

    // 4. Verification summary — query actual counts to confirm insertion
    console.log('═══════════════════════════════════════════════════════');
    console.log('  VERIFICATION SUMMARY');
    console.log('═══════════════════════════════════════════════════════');

    // Count per company
    const companyCounts = await Question.aggregate([
      { $group: { _id: '$company', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    console.log('\n📊  Questions by Company:');
    companyCounts.forEach(({ _id: company, count }) => {
      console.log(`     ${company.padEnd(12)} ${count}`);
    });

    // Count per type
    const typeCounts = await Question.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    console.log('\n📊  Questions by Type:');
    typeCounts.forEach(({ _id: type, count }) => {
      console.log(`     ${type.padEnd(14)} ${count}`);
    });

    // Total
    const totalCount = await Question.countDocuments();
    console.log(`\n✅  Total questions in database: ${totalCount}`);
    console.log('═══════════════════════════════════════════════════════\n');

    // 5. Clean disconnect
    await mongoose.disconnect();
    console.log('🔌  MongoDB disconnected. Seed complete.');
    process.exit(0);
  } catch (error) {
    console.error('❌  Seed script failed:', error.message);
    console.error(error.stack);

    // Attempt to disconnect even on failure to avoid hanging connections
    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      console.error('❌  Failed to disconnect:', disconnectError.message);
    }

    process.exit(1);
  }
};

// Execute the seed
runSeed();
