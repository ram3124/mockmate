import { useState, useEffect } from 'react';
import {
  getAdminQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
} from '../services/api';

// Enums hardcoded straight from Question.js Mongoose Schema validation arrays
const ALLOWED_COMPANIES = ['Google', 'Amazon', 'Flipkart', 'Microsoft', 'TCS', 'Infosys', 'General'];
const ALLOWED_TYPES = ['DSA', 'HR', 'CoreCS', 'SystemDesign'];
const ALLOWED_DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

function extractErrorMessage(err) {
  return (
    err.response?.data?.message ||
    err.response?.data?.error ||
    'An unexpected error occurred during database mutation.'
  );
}

export default function AdminQuestionsPage() {
  // ── Component State Management ─────────────────────────────────────────
  const [questions, setQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [globalError, setGlobalError] = useState('');

  // Form Modal Toggles
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [editingId, setEditingId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Delete Safeguard States
  const [deleteTarget, setDeleteTarget] = useState(null); // holds question object
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Question Schema Structured Form Fields ─────────────────────────────
  const [text, setText] = useState('');
  const [company, setCompany] = useState('General');
  const [type, setType] = useState('DSA');
  const [difficulty, setDifficulty] = useState('Medium');
  const [topic, setTopic] = useState('');
  const [keyPoints, setKeyPoints] = useState(['']); // Repeatable dynamic text strings array
  const [modelAnswer, setModelAnswer] = useState('');
  const [timeLimit, setTimeLimit] = useState(300);

  // ── Fetch Questions on Mount ───────────────────────────────────────────
  const loadQuestionsList = async () => {
    setIsLoading(true);
    setGlobalError('');
    try {
      const response = await getAdminQuestions();
      // Adjust to support standard wrapper responses variations gracefully
      const data = response.data;
      setQuestions(Array.isArray(data) ? data : data.questions || []);
    } catch (err) {
      setGlobalError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadQuestionsList();
  }, []);

  // ── Modal Actions & Reset Handlers ─────────────────────────────────────
  const openCreateModal = () => {
    setModalMode('create');
    setEditingId(null);
    setValidationError('');
    // Clear back to native baseline defaults matching model
    setText('');
    setCompany('General');
    setType('DSA');
    setDifficulty('Medium');
    setTopic('');
    setKeyPoints(['']);
    setModelAnswer('');
    setTimeLimit(300);
    setIsModalOpen(true);
  };

  const openEditModal = (q) => {
    setModalMode('edit');
    setEditingId(q._id);
    setValidationError('');
    // Map structural data payload precisely from existing schema entry
    setText(q.text || '');
    setCompany(q.company || 'General');
    setType(q.type || 'DSA');
    setDifficulty(q.difficulty || 'Medium');
    setTopic(q.topic || '');
    setKeyPoints(Array.isArray(q.keyPoints) && q.keyPoints.length > 0 ? [...q.keyPoints] : ['']);
    setModelAnswer(q.modelAnswer || '');
    setTimeLimit(q.timeLimit || 300);
    setIsModalOpen(true);
  };

  // ── Dynamic Array Control Elements for Repeatable Inputs ───────────────
  const handleAddKeyPoint = () => {
    setKeyPoints([...keyPoints, '']);
  };

  const handleKeyPointChange = (index, value) => {
    const updated = [...keyPoints];
    updated[index] = value;
    setKeyPoints(updated);
  };

  const handleRemoveKeyPoint = (index) => {
    // Keep at least one tracking slot in UI tree structure
    if (keyPoints.length <= 1) {
      const updated = [...keyPoints];
      updated[0] = '';
      setKeyPoints(updated);
      return;
    }
    setKeyPoints(keyPoints.filter((_, i) => i !== index));
  };

  // ── Form Submission Validation & Mutator Dispatches ───────────────────
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');

    // Pre-filtering cleanup: strip out empty/whitespace spaces per requirements
    const cleanedKeyPoints = keyPoints.map((p) => p.trim()).filter((p) => p !== '');

    // Strict schema-enforced baseline client constraints checks
    if (!text.trim() || text.trim().length < 10) {
      setValidationError('Question text is required and must track at least 10 characters.');
      return;
    }
    if (!topic.trim()) {
      setValidationError('A valid topic category string is required.');
      return;
    }
    if (cleanedKeyPoints.length < 1) {
      setValidationError('At least 1 active, evaluation Key Point criterion must be supplied.');
      return;
    }
    if (!modelAnswer.trim() || modelAnswer.trim().length < 20) {
      setValidationError('Model evaluation answer is required and must be at least 20 characters.');
      return;
    }
    if (Number(timeLimit) < 60 || Number(timeLimit) > 1800) {
      setValidationError('Time limit must map between 60 seconds (1 min) and 1800 seconds (30 mins).');
      return;
    }

    const payload = {
      text: text.trim(),
      company,
      type,
      difficulty,
      topic: topic.trim(),
      keyPoints: cleanedKeyPoints,
      modelAnswer: modelAnswer.trim(),
      timeLimit: Number(timeLimit),
    };

    setIsSaving(true);
    try {
      if (modalMode === 'create') {
        await createQuestion(payload);
      } else {
        await updateQuestion(editingId, payload);
      }
      setIsModalOpen(false);
      await loadQuestionsList(); // Refresh authoritative data grid views
    } catch (err) {
      setValidationError(extractErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  // ── Secure Confirmation Deletion Sequence ─────────────────────────────
  const initiateDelete = (q) => {
    setDeleteTarget(q);
  };

  const executeDeleteAction = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteQuestion(deleteTarget._id);
      setDeleteTarget(null);
      await loadQuestionsList();
    } catch (err) {
      alert(`Deletion failure rollback triggered: ${extractErrorMessage(err)}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-900 text-surface-100 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Top Management Controls Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Question Pool Operations</h1>
            <p className="text-sm text-surface-200/40 mt-1">Admin level CRUD dashboard matrix for system prompt configurations.</p>
          </div>
          <button
            onClick={openCreateModal}
            className="sm:self-start px-4 py-2 rounded-xl text-sm font-semibold text-white bg-primary-600 hover:bg-primary-500 transition-colors cursor-pointer shadow-md shadow-primary-600/10"
          >
            + Add New Question
          </button>
        </div>

        {/* Global Error Banner Panel */}
        {globalError && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-center gap-2">
            <span>⚠️ Error: {globalError}</span>
            <button onClick={loadQuestionsList} className="ml-auto underline font-medium text-xs text-red-200">Retry Synchronization</button>
          </div>
        )}

        {/* Data View Controller Layout Matrix */}
        {isLoading ? (
          <div className="py-24 text-center">
            <svg className="animate-spin h-8 w-8 text-primary-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-surface-200/40 text-sm font-medium">Hydrating active schema datagrid arrays...</p>
          </div>
        ) : questions.length === 0 ? (
          <div className="glass-card rounded-2xl py-20 px-4 text-center border border-white/5 bg-white/[0.01]">
            <span className="text-4xl block mb-2">📋</span>
            <h3 className="text-lg font-semibold text-white mb-1">Question Repository Empty</h3>
            <p className="text-sm text-surface-200/30 max-w-sm mx-auto mb-4">No questions exist in this database environment configuration file trace setup yet.</p>
            <button onClick={openCreateModal} className="px-4 py-2 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/15 text-white border border-white/10 transition-colors">Seed Core Entry</button>
          </div>
        ) : (
          <div className="glass-card rounded-2xl overflow-hidden border border-white/5 bg-white/[0.01] backdrop-blur-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.02] text-xs font-semibold uppercase text-surface-200/40 tracking-wider">
                    <th className="py-4 px-6">Prompt Context</th>
                    <th className="py-4 px-6 w-32">Topic Area</th>
                    <th className="py-4 px-6 w-28">Complexity</th>
                    <th className="py-4 px-6 w-24 text-center">Criteria</th>
                    <th className="py-4 px-6 w-36 text-right">Operations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {questions.map((q) => (
                    <tr key={q._id} className="hover:bg-white/[0.01] transition-colors group">
                      <td className="py-4 px-6 max-w-xs md:max-w-md lg:max-w-lg">
                        <p className="text-white font-medium line-clamp-2 leading-relaxed">{q.text}</p>
                        <div className="flex items-center gap-2 text-xs text-surface-200/30 mt-1">
                          <span className="text-primary-300 font-medium">{q.company}</span>
                          <span>•</span>
                          <span>Track: {q.type}</span>
                          <span>•</span>
                          <span>Timer: {q.timeLimit}s</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-surface-100 font-mono text-xs">{q.topic}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium border ${
                          q.difficulty === 'Easy' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                          q.difficulty === 'Hard' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                          'bg-amber-500/10 border-amber-500/20 text-amber-400'
                        }`}>
                          {q.difficulty}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center font-mono text-surface-200/50">
                        {Array.isArray(q.keyPoints) ? q.keyPoints.length : 0}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(q)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-surface-100 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 transition-colors cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => initiateDelete(q)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-400 hover:text-red-300 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 transition-colors cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Add / Edit Core Dialog Overlay Modal View ──────────────── */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-surface-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="glass-card w-full max-w-2xl rounded-2xl border border-white/10 bg-surface-900 p-6 shadow-2xl relative animate-fade-in">
              <h2 className="text-xl font-bold text-white mb-4">
                {modalMode === 'create' ? 'Assemble Schema Prompt Node' : 'Modify Existing Question Node'}
              </h2>

              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-surface-200/40 uppercase tracking-wider mb-1">Question Prompt Text (Min 10 characters)</label>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={3}
                    className="w-full rounded-xl bg-white/5 border border-white/10 text-surface-100 p-3 text-sm focus:outline-none focus:border-primary-500 transition-colors resize-y"
                    placeholder="Describe technical task requirements completely..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-surface-200/40 uppercase tracking-wider mb-1">Target Corporate Context</label>
                    <select
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="w-full rounded-xl bg-surface-950 border border-white/10 text-surface-100 p-2.5 text-sm focus:outline-none focus:border-primary-500"
                    >
                      {ALLOWED_COMPANIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-surface-200/40 uppercase tracking-wider mb-1">Track Category</label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      className="w-full rounded-xl bg-surface-950 border border-white/10 text-surface-100 p-2.5 text-sm focus:outline-none focus:border-primary-500"
                    >
                      {ALLOWED_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-surface-200/40 uppercase tracking-wider mb-1">Complexity Level</label>
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                      className="w-full rounded-xl bg-surface-950 border border-white/10 text-surface-100 p-2.5 text-sm focus:outline-none focus:border-primary-500"
                    >
                      {ALLOWED_DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-surface-200/40 uppercase tracking-wider mb-1">Specific Field Topic Token</label>
                    <input
                      type="text"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="w-full rounded-xl bg-white/5 border border-white/10 text-surface-100 p-2.5 text-sm focus:outline-none focus:border-primary-500"
                      placeholder="e.g. Red Black Trees"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-surface-200/40 uppercase tracking-wider mb-1">Authoritative Clock Enforcement Limit (Seconds)</label>
                    <input
                      type="number"
                      value={timeLimit}
                      onChange={(e) => setTimeLimit(e.target.value)}
                      className="w-full rounded-xl bg-white/5 border border-white/10 text-surface-100 p-2.5 text-sm font-mono focus:outline-none focus:border-primary-500"
                      min="60"
                      max="1800"
                    />
                  </div>
                </div>

                {/* Repeatable Entry Array for Evaluation Metrics */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-surface-200/40 uppercase tracking-wider">Authoritative Grading Evaluation Key Points</label>
                    <button
                      type="button"
                      onClick={handleAddKeyPoint}
                      className="text-xs font-bold text-primary-400 hover:text-primary-300 transition-colors"
                    >
                      + Add key point
                    </button>
                  </div>
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {keyPoints.map((point, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={point}
                          onChange={(e) => handleKeyPointChange(index, e.target.value)}
                          className="flex-1 rounded-xl bg-white/5 border border-white/10 text-surface-100 p-2 text-sm focus:outline-none focus:border-primary-500"
                          placeholder={`Key verification parameter #${index + 1}`}
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveKeyPoint(index)}
                          className="px-2 py-1.5 rounded-lg text-xs font-bold text-red-400/70 hover:bg-red-500/10 transition-colors"
                          title="Erase row"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-surface-200/40 uppercase tracking-wider mb-1">AI Comparator Reference Model Answer (Min 20 characters)</label>
                  <textarea
                    value={modelAnswer}
                    onChange={(e) => setModelAnswer(e.target.value)}
                    rows={4}
                    className="w-full rounded-xl bg-white/5 border border-white/10 text-surface-100 p-3 text-sm focus:outline-none focus:border-primary-500 transition-colors resize-y font-mono"
                    placeholder="Paste structural algorithmic code or perfect conceptual outline summaries here..."
                  />
                </div>

                {validationError && (
                  <p className="text-xs font-medium text-red-400 bg-red-500/5 border border-red-500/10 p-2.5 rounded-lg">
                    ⚠️ {validationError}
                  </p>
                )}

                <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    disabled={isSaving}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-surface-200 hover:text-white border border-white/10 hover:bg-white/5 transition-colors disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-primary-600 hover:bg-primary-500 transition-colors disabled:opacity-40 flex items-center gap-2"
                  >
                    {isSaving && (
                      <svg className="animate-spin h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    )}
                    {modalMode === 'create' ? 'Compile Entry' : 'Apply Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Permanent Delete Warning Confirmation Modal Dialog ────────── */}
        {deleteTarget && (
          <div className="fixed inset-0 z-50 bg-surface-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="glass-card w-full max-w-sm rounded-2xl border border-red-500/20 bg-surface-900 p-6 text-center shadow-2xl">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-3 text-red-400 text-xl font-bold">!</div>
              <h3 className="text-lg font-bold text-white mb-1">Destructive Action Warning</h3>
              <p className="text-xs text-surface-200/50 mb-5 leading-relaxed">
                Are you sure you want to permanently erase this question record? Existing student session histories referencing this question node could experience metric evaluation splits.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-white/10 text-surface-200 hover:text-white transition-colors disabled:opacity-40 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={executeDeleteAction}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
                >
                  {isDeleting && (
                    <svg className="animate-spin h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  )}
                  Confirm Erasure
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}