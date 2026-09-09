import Layout from '../../components/layout.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.jsx';

export default function EvidencePage() {
  return (
    <Layout>
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Evidence</h1>
          <p className="mt-1 text-sm text-slate-500">
            Your readiness estimates are built from evidence — assessments, projects, resume,
            GitHub, and practice records. Everything is traceable.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>No evidence yet</CardTitle>
            <CardDescription>
              Evidence collection is coming soon. You will be able to record projects, external
              practice, assessments, and connect GitHub.
            </CardDescription>
          </CardHeader>
          <CardContent className="rounded-b-xl bg-slate-50 p-6 text-sm text-slate-500">
            Planned sources: technical assessments · coding · SQL · projects · practical tasks ·
            DSA practice · resume · GitHub · certifications.
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}