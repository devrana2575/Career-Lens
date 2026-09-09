import Layout from '../../components/layout.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.jsx';

export default function AssessmentsPage() {
  return (
    <Layout>
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Assessments</h1>
          <p className="mt-1 text-sm text-slate-500">
            Skill evaluations that produce genuinely meaningful evidence about your abilities.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Assessment engine coming soon</CardTitle>
            <CardDescription>
              MCQ, coding, SQL, debugging and practical-case assessments per target role.
            </CardDescription>
          </CardHeader>
          <CardContent className="rounded-b-xl bg-slate-50 p-6 text-sm text-slate-500">
            Questions and scoring rules are stored as data so assessment sets can evolve without
            code changes.
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}