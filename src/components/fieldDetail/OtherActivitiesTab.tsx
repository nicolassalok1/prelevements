import { useField } from './shared'
import { QuickAddActivityButton, ActivityList } from './activityList'

export function OtherActivitiesTab() {
  const field = useField()
  const isArchived = !!field.archived
  return (
    <div className="space-y-4">
      <QuickAddActivityButton fieldId={field.id} type="other" disabled={isArchived} />
      <ActivityList fieldId={field.id} type="other" showEmpty />
    </div>
  )
}
