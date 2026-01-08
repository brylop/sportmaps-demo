import { UnderConstruction } from '@/components/common/UnderConstruction';

interface UnderConstructionPageProps {
  title: string;
  description?: string;
}

export default function UnderConstructionPage({ title, description }: UnderConstructionPageProps) {
  return <UnderConstruction title={title} description={description} />;
}
