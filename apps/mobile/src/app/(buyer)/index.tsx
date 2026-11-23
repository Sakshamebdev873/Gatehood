import { useAuth } from '@/auth/AuthProvider';
import { Placeholder } from '@/components/Placeholder';

/** My Unit. Phase 10 builds the real screen. */
export default function BuyerHome() {
  const { towerId, unitId } = useAuth();
  return <Placeholder eyebrow={unitId ? `Unit ${unitId}` : 'My unit'} title={`Tower ${towerId ?? ''}`} em="your home." />;
}
