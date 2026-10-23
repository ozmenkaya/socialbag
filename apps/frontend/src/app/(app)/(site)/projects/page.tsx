import { ProjectsComponent } from '@gitroom/frontend/components/projects/projects.component';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';

export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Postiz' : 'Gitroom'} Projects`,
  description: '',
};

export default async function Page() {
  return <ProjectsComponent />;
}
