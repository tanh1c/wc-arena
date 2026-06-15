import AppShell from '../components/layout/AppShell';
import PageHero from '../components/ui/PageHero';
import Panel from '../components/ui/Panel';
import type { ThemeControls } from '../App';

type PlaceholderPageProps = {
  title: string;
  description: string;
  themeControls: ThemeControls;
};

export default function PlaceholderPage({ title, description, themeControls }: PlaceholderPageProps) {
  return (
    <AppShell themeControls={themeControls}>
      <div className="relative z-10 flex flex-col p-4 lg:p-6 gap-4 lg:gap-6 bg-page flex-1">
        <PageHero title={title} description={description} />
        <Panel title="Coming Next">
          <div className="p-6 bg-card font-bold text-sm text-subtle">
            This route is wired for the frontend foundation pass. The full feature UI will be built in a later phase.
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
