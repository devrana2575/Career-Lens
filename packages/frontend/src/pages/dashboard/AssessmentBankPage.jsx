import { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '../../components/layout.jsx';
import { apiFetch } from '../../lib/api.js';
import { useAuth } from '../../lib/auth-context.jsx';
import { Button } from '../../components/ui/button.jsx';
import { Input } from '../../components/ui/input.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.jsx';
import { cn } from '../../lib/utils.js';

const REVIEWER_ROLES = ['admin', 'mentor'];
const AUTO_TYPES = ['mcq', 'sql', 'coding'];
const RUBRIC_TYPES = ['practical', 'case_study'];
const OTHER_TYPES = ['debugging', 'written', 'project'];
const ALL_TYPES = [...AUTO_TYPES, ...RUBRIC_TYPES, ...OTHER_TYPES];
const TYPE_LABELS = {
  mcq: 'Multiple choice',
  sql: 'SQL query',
  coding: 'Coding',
  practical: 'Practical',
  case_study: 'Case study',
  debugging: 'Debugging',
  written: 'Written',
  project: 'Project',
};

const CODING_TEMPLATE = JSON.stringify(
  { language: 'python', cases: [{ input: '3\n', expectedOutput: '9\n' }] },
  null,
  2,
);
const SQL_TEMPLATE = JSON.stringify(
  {
    schema: {
      tables: [
        { name: 'employees', columns: [{ name: 'name', type: 'TEXT' }], rows: [['ada']] },
      ],
    },
    expected: { columns: ['name'], rows: [['ada']] },
  },
  null,
  2,
);

function allowedQuestionTypes(assessmentType) {
  if (AUTO_TYPES.includes(assessmentType)) return AUTO_TYPES;
  if (RUBRIC_TYPES.includes(assessmentType)) return [...RUBRIC_TYPES, ...OTHER_TYPES];
  return ALL_TYPES;
}

function defaultOptions() {
  return [
    { id: 'a', text: '' },
    { id: 'b', text: '' },
  ];
}

function defaultRubric() {
  return [{ id: 'c1', label: '', description: '', maxPoints: 1 }];
}

function newQuestion(type) {
  return {
    id: null,
    type,
    prompt: '',
    points: 1,
    difficulty: 'intermediate',
    explanation: '',
    options: defaultOptions(),
    correctOptionId: 'a',
    configText: type === 'coding' ? CODING_TEMPLATE : type === 'sql' ? SQL_TEMPLATE : '',
    rubric: defaultRubric(),
  };
}

function toEditorQuestion(q) {
  const jsonType = q.type === 'sql' || q.type === 'coding';
  return {
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    points: q.points,
    difficulty: q.difficulty ?? 'intermediate',
    explanation: q.explanation ?? '',
    options: q.options?.length ? q.options : defaultOptions(),
    correctOptionId: q.correctOptionId ?? '',
    configText: jsonType ? JSON.stringify(q.config ?? {}, null, 2) : '',
    rubric: q.rubric?.length ? q.rubric : defaultRubric(),
  };
}

function emptyAssessment() {
  return {
    id: null,
    title: '',
    description: '',
    type: 'mcq',
    skillId: '',
    roleId: '',
    timeLimitMinutes: 10,
    isActive: true,
  };
}

export default function AssessmentBankPage() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [skills, setSkills] = useState([]);
  const [roles, setRoles] = useState([]);
  const [editor, setEditor] = useState(null);
  const [removedIds, setRemovedIds] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const { assessments } = await apiFetch('/assessment-bank');
    setList(assessments);
  }, []);

  useEffect(() => {
    if (!REVIEWER_ROLES.includes(user?.role)) {
      setLoading(false);
      return;
    }
    Promise.all([refresh(), apiFetch('/skills'), apiFetch('/roles')])
      .then(([, skillRes, roleRes]) => {
        setSkills(skillRes.skills ?? []);
        setRoles(roleRes.roles ?? []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [refresh, user]);

  const skillById = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);

  function openNew() {
    setEditor({ ...emptyAssessment(), skillId: skills[0]?.id ?? '', questions: [] });
    setRemovedIds([]);
    setError('');
    setSuccess('');
  }

  async function openExisting(id) {
    setError('');
    setSuccess('');
    try {
      const { assessment, questions } = await apiFetch(`/assessment-bank/${id}`);
      setEditor({
        id: assessment.id,
        title: assessment.title,
        description: assessment.description ?? '',
        type: assessment.type,
        skillId: assessment.skillId,
        roleId: assessment.roleId ?? '',
        timeLimitMinutes: assessment.timeLimitMinutes,
        isActive: assessment.isActive,
      });
      setQuestions(questions.map(toEditorQuestion));
      setRemovedIds([]);
    } catch (err) {
      setError(err.message);
    }
  }

  function setQuestions(questions) {
    setEditor((prev) => (prev ? { ...prev, questions } : prev));
  }

  function updateQuestion(index, patch) {
    setEditor((prev) => {
      const questions = prev.questions.map((q, i) => (i === index ? { ...q, ...patch } : q));
      return { ...prev, questions };
    });
  }

  return (
    <Layout>
      <div className="max-w-4xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Assessment bank</h1>
            <p className="mt-1 text-sm text-slate-500">
              Author assessments and their questions. Saved definitions are immediately runnable by
              students and reviewed against their rubric.
            </p>
          </div>
          {REVIEWER_ROLES.includes(user?.role) && !editor && (
            <Button onClick={openNew}>New assessment</Button>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-700">{success}</p>}

        {!REVIEWER_ROLES.includes(user?.role) ? (
          <Card>
            <CardContent className="text-sm text-slate-500">
              Only admins and mentors can manage the assessment bank.
            </CardContent>
          </Card>
        ) : loading ? (
          <Card>
            <CardContent className="text-sm text-slate-500">Loading…</CardContent>
          </Card>
        ) : editor ? (
          <Editor
            editor={editor}
            setEditor={setEditor}
            skills={skills}
            roles={roles}
            updateQuestion={updateQuestion}
            setRemovedIds={setRemovedIds}
            saving={saving}
            onCancel={() => setEditor(null)}
            onSave={handleSave}
          />
        ) : list.length === 0 ? (
          <Card>
            <CardContent className="text-sm text-slate-500">
              No assessments yet. Create the first one to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {list.map((a) => (
              <Card key={a.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base">{a.title}</CardTitle>
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-1 text-xs font-medium',
                        a.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500',
                      )}
                    >
                      {a.isActive ? 'Active' : 'Archived'}
                    </span>
                  </div>
                  <CardDescription>
                    {TYPE_LABELS[a.type] ?? a.type} · {a.skillName ?? skillById.get(a.skillId)?.name ?? a.skillId}
                    {a.roleName ? ` · ${a.roleName}` : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-3">
                  <p className="text-sm text-slate-600">
                    {a.questionCount} questions · {a.timeLimitMinutes} min
                  </p>
                  <Button size="sm" variant="outline" onClick={() => openExisting(a.id)}>
                    Edit
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );

  async function handleSave() {
    const problem = validateEditor(editor);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const assessmentPayload = {
        title: editor.title.trim(),
        description: editor.description.trim() || null,
        type: editor.type,
        skillId: editor.skillId,
        roleId: editor.roleId || null,
        timeLimitMinutes: Number(editor.timeLimitMinutes) || 10,
        isActive: editor.isActive,
      };

      let assessmentId = editor.id;
      if (assessmentId) {
        await apiFetch(`/assessment-bank/${assessmentId}`, {
          method: 'PUT',
          body: assessmentPayload,
        });
      } else {
        const created = await apiFetch('/assessment-bank', { method: 'POST', body: assessmentPayload });
        assessmentId = created.id;
      }

      const keptIds = new Set(editor.questions.map((q) => q.id).filter(Boolean));
      for (let i = 0; i < editor.questions.length; i += 1) {
        const payload = buildQuestionPayload(editor.questions[i], i);
        const existingId = editor.questions[i].id;
        if (existingId) {
          await apiFetch(`/assessment-bank/questions/${existingId}`, { method: 'PUT', body: payload });
        } else {
          await apiFetch(`/assessment-bank/${assessmentId}/questions`, { method: 'POST', body: payload });
        }
      }

      for (const removedId of removedIds) {
        if (keptIds.has(removedId)) continue;
        await apiFetch(`/assessment-bank/questions/${removedId}`, { method: 'DELETE' });
      }

      await refresh();
      setEditor(null);
      setRemovedIds([]);
      setSuccess('Assessment saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }
}

function validateEditor(editor) {
  if (!editor) return 'Nothing to save.';
  if (!editor.title.trim()) return 'Give the assessment a title.';
  if (!editor.skillId) return 'Pick a skill for the assessment.';
  if (editor.questions.length === 0) return 'Add at least one question.';

  for (let i = 0; i < editor.questions.length; i += 1) {
    const q = editor.questions[i];
    if (!q.prompt.trim()) return `Question ${i + 1} needs a prompt.`;
    if (q.type === 'mcq') {
      const filled = q.options.filter((o) => o.text.trim());
      if (filled.length < 2) return `Question ${i + 1} needs at least two options.`;
      if (!filled.some((o) => o.id === q.correctOptionId)) {
        return `Question ${i + 1} needs a valid correct option.`;
      }
    }
    if (q.type === 'sql' || q.type === 'coding') {
      try {
        JSON.parse(q.configText || '{}');
      } catch {
        return `Question ${i + 1} config is not valid JSON.`;
      }
    }
    if ((q.type === 'practical' || q.type === 'case_study') && !q.rubric.some((c) => c.label.trim())) {
      return `Question ${i + 1} needs at least one rubric criterion.`;
    }
  }
  return null;
}

function buildQuestionPayload(q, orderIndex) {
  const jsonType = q.type === 'sql' || q.type === 'coding';
  return {
    type: q.type,
    prompt: q.prompt.trim(),
    points: Number(q.points) || 0,
    difficulty: q.difficulty,
    explanation: q.explanation.trim() || null,
    orderIndex,
    options: q.type === 'mcq' ? q.options.filter((o) => o.text.trim()) : [],
    correctOptionId: q.type === 'mcq' ? q.correctOptionId || null : null,
    rubric: q.type === 'practical' || q.type === 'case_study' ? q.rubric : [],
    config: jsonType ? JSON.parse(q.configText || '{}') : {},
  };
}

function Editor({
  editor,
  setEditor,
  skills,
  roles,
  updateQuestion,
  setRemovedIds,
  saving,
  onCancel,
  onSave,
}) {
  const types = allowedQuestionTypes(editor.type);

  function setField(field, value) {
    setEditor((prev) => {
      if (field === 'type') {
        const questions = prev.questions.map((q) => {
          if (types.includes(q.type)) return q;
          return { ...q, type: value };
        });
        return { ...prev, type: value, questions };
      }
      return { ...prev, [field]: value };
    });
  }

  function addQuestion() {
    setEditor((prev) => ({
      ...prev,
      questions: [...prev.questions, newQuestion(prev.type)],
    }));
  }

  function removeQuestion(index) {
    setEditor((prev) => {
      const target = prev.questions[index];
      if (target?.id) setRemovedIds((ids) => [...ids, target.id]);
      return { ...prev, questions: prev.questions.filter((_, i) => i !== index) };
    });
  }

  function changeQuestionType(index, type) {
    const q = editor.questions[index];
    const patch = { type };
    if (type === 'sql' && !q.configText.trim()) patch.configText = SQL_TEMPLATE;
    if (type === 'coding' && !q.configText.trim()) patch.configText = CODING_TEMPLATE;
    updateQuestion(index, patch);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assessment details</CardTitle>
          <CardDescription>Metadata shown to students before they start.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" className="sm:col-span-2">
            <Input value={editor.title} onChange={(e) => setField('title', e.target.value)} />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <textarea
              value={editor.description}
              onChange={(e) => setField('description', e.target.value)}
              rows={2}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </Field>
          <Field label="Grading type">
            <select
              value={editor.type}
              onChange={(e) => setField('type', e.target.value)}
              className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400"
            >
              {ALL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Skill">
            <select
              value={editor.skillId}
              onChange={(e) => setField('skillId', e.target.value)}
              className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400"
            >
              <option value="">Select a skill…</option>
              {skills.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Target role (optional)">
            <select
              value={editor.roleId}
              onChange={(e) => setField('roleId', e.target.value)}
              className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400"
            >
              <option value="">Any role</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Time limit (minutes)">
            <Input
              type="number"
              min={1}
              max={600}
              value={editor.timeLimitMinutes}
              onChange={(e) => setField('timeLimitMinutes', e.target.value)}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={editor.isActive}
              onChange={(e) => setField('isActive', e.target.checked)}
            />
            Active
          </label>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-slate-900">Questions</h2>
        <Button size="sm" variant="outline" onClick={addQuestion}>
          Add question
        </Button>
      </div>

      {editor.questions.length === 0 && (
        <Card>
          <CardContent className="text-sm text-slate-500">No questions yet.</CardContent>
        </Card>
      )}

      {editor.questions.map((q, index) => (
        <QuestionEditor
          key={q.id ?? `new-${index}`}
          question={q}
          index={index}
          types={types}
          onChange={(patch) => updateQuestion(index, patch)}
          onChangeType={(type) => changeQuestionType(index, type)}
          onRemove={() => removeQuestion(index)}
        />
      ))}

      <div className="flex items-center gap-3">
        <Button onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save assessment'}
        </Button>
        <button onClick={onCancel} className="text-sm text-slate-500 hover:text-slate-700">
          Cancel
        </button>
      </div>
    </div>
  );
}

function QuestionEditor({ question, index, types, onChange, onChangeType, onRemove }) {
  function addOption() {
    const id = String.fromCharCode(97 + question.options.length);
    onChange({ options: [...question.options, { id, text: '' }] });
  }

  function updateOption(optIndex, text) {
    const options = question.options.map((o, i) => (i === optIndex ? { ...o, text } : o));
    onChange({ options });
  }

  function removeOption(optIndex) {
    const idMap = {};
    const options = question.options
      .filter((_, i) => i !== optIndex)
      .map((o, i) => {
        const id = String.fromCharCode(97 + i);
        idMap[o.id] = id;
        return { ...o, id };
      });
    const correctOptionId = idMap[question.correctOptionId] ?? options[0]?.id ?? '';
    onChange({ options, correctOptionId });
  }

  function addCriterion() {
    const id = `c${question.rubric.length + 1}`;
    onChange({ rubric: [...question.rubric, { id, label: '', description: '', maxPoints: 1 }] });
  }

  function updateCriterion(cIndex, patch) {
    const rubric = question.rubric.map((c, i) => (i === cIndex ? { ...c, ...patch } : c));
    onChange({ rubric });
  }

  function removeCriterion(cIndex) {
    const rubric = question.rubric
      .filter((_, i) => i !== cIndex)
      .map((c, i) => ({ ...c, id: `c${i + 1}` }));
    onChange({ rubric });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Question {index + 1}</CardTitle>
          <button onClick={onRemove} className="text-sm text-red-600 hover:text-red-700">
            Remove
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Type">
            <select
              value={question.type}
              onChange={(e) => onChangeType(e.target.value)}
              className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400"
            >
              {types.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Difficulty">
            <select
              value={question.difficulty}
              onChange={(e) => onChange({ difficulty: e.target.value })}
              className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </Field>
          <Field label="Points">
            <Input
              type="number"
              min={0}
              max={100}
              value={question.points}
              onChange={(e) => onChange({ points: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Prompt">
          <textarea
            value={question.prompt}
            onChange={(e) => onChange({ prompt: e.target.value })}
            rows={2}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
        </Field>

        {question.type === 'mcq' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">Options</p>
              <Button size="sm" variant="outline" onClick={addOption}>
                Add option
              </Button>
            </div>
            {question.options.map((option, optIndex) => (
              <div key={option.id} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`correct-${question.id ?? index}`}
                  checked={question.correctOptionId === option.id}
                  onChange={() => onChange({ correctOptionId: option.id })}
                />
                <span className="w-5 text-sm text-slate-400">{option.id}</span>
                <Input
                  value={option.text}
                  onChange={(e) => updateOption(optIndex, e.target.value)}
                  placeholder={`Option ${option.id.toUpperCase()}`}
                />
                <button
                  onClick={() => removeOption(optIndex)}
                  className="text-sm text-slate-400 hover:text-red-600"
                >
                  ✕
                </button>
              </div>
            ))}
            <p className="text-xs text-slate-500">Select the radio next to the correct answer.</p>
          </div>
        )}

        {(question.type === 'sql' || question.type === 'coding') && (
          <Field label={question.type === 'sql' ? 'Config (schema + expected)' : 'Config (language + cases)'}>
            <textarea
              value={question.configText}
              onChange={(e) => onChange({ configText: e.target.value })}
              rows={8}
              spellCheck={false}
              className="w-full rounded-md border border-slate-200 bg-slate-900 px-3 py-2 font-mono text-xs text-slate-100 outline-none focus:border-indigo-400"
            />
            <p className="mt-1 text-xs text-slate-500">JSON is validated when you save.</p>
          </Field>
        )}

        {(question.type === 'practical' || question.type === 'case_study') && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">Rubric</p>
              <Button size="sm" variant="outline" onClick={addCriterion}>
                Add criterion
              </Button>
            </div>
            {question.rubric.map((criterion, cIndex) => (
              <div key={criterion.id} className="grid gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-12">
                <Input
                  className="sm:col-span-4"
                  value={criterion.label}
                  onChange={(e) => updateCriterion(cIndex, { label: e.target.value })}
                  placeholder="Criterion"
                />
                <Input
                  className="sm:col-span-5"
                  value={criterion.description}
                  onChange={(e) => updateCriterion(cIndex, { description: e.target.value })}
                  placeholder="Description"
                />
                <Input
                  className="sm:col-span-2"
                  type="number"
                  min={1}
                  value={criterion.maxPoints}
                  onChange={(e) =>
                    updateCriterion(cIndex, { maxPoints: Number(e.target.value) || 1 })
                  }
                />
                <button
                  onClick={() => removeCriterion(cIndex)}
                  className="text-sm text-slate-400 hover:text-red-600 sm:col-span-1"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <Field label="Explanation (optional, shown after grading)">
          <textarea
            value={question.explanation}
            onChange={(e) => onChange({ explanation: e.target.value })}
            rows={2}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
        </Field>
      </CardContent>
    </Card>
  );
}

function Field({ label, children, className }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}
