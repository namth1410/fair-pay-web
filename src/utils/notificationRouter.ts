/**
 * Khi 1 notification realtime đến: ngoài prepend vào inbox + toast, refetch dữ
 * liệu liên quan để UI cập nhật ngay — CHỈ khi user đang xem đúng nhóm/chuyến đó
 * (tránh ghi đè state của màn khác).
 */
import { useGroupStore } from '../stores/group.store';
import { useTripStore } from '../stores/trip.store';

function fireAndForget(p: Promise<unknown>) {
  p.catch((e) => {
    if (__DEV__) console.warn('[NotifRoute] refetch failed:', e);
  });
}

/** Route của 1 notification (dùng khi bấm vào thông báo). */
export function getDeepLinkForNotification(
  type: string,
  groupId: string | null,
  tripId: string | null,
): string | null {
  switch (type) {
    case 'expense.created':
    case 'expense.edited':
    case 'expense.deleted':
    case 'payment.recorded':
    case 'payment.received':
    case 'trip.closed':
    case 'trip.cleared':
    case 'trip.reminder_settle':
      return tripId ? `/trips/${tripId}` : groupId ? `/groups/${groupId}` : null;

    case 'member.join_requested':
    case 'member.role_change':
    case 'member.invite_accepted':
    case 'member.invite_declined':
    case 'trip.deleted':
      return groupId ? `/groups/${groupId}` : null;

    case 'member.join_approved':
      return groupId ? `/groups/${groupId}` : '/';

    case 'member.join_rejected':
    case 'member.invite_received':
    case 'member.invite_revoked':
      return '/';

    default:
      return tripId ? `/trips/${tripId}` : groupId ? `/groups/${groupId}` : null;
  }
}

export function dispatchNotificationRefetch(
  type: string,
  groupId: string | null,
  tripId: string | null,
): void {
  const groupState = useGroupStore.getState();
  const tripState = useTripStore.getState();

  switch (type) {
    case 'member.join_requested':
      if (groupId && groupState.currentGroupId === groupId && groupState.myRole === 'admin') {
        fireAndForget(groupState.loadAdminExtras(groupId));
      }
      break;

    case 'member.join_approved':
    case 'member.join_rejected':
      fireAndForget(groupState.loadMyPendingJoinRequests());
      if (type === 'member.join_approved') fireAndForget(groupState.loadGroups({ quiet: true }));
      break;

    case 'member.role_change':
      if (groupId && groupState.currentGroupId === groupId) {
        fireAndForget(groupState.loadMembers(groupId));
      }
      break;

    case 'member.invite_received':
    case 'member.invite_revoked':
      fireAndForget(groupState.loadMyPendingInvitations());
      break;

    case 'member.invite_accepted':
    case 'member.invite_declined':
      if (groupId && groupState.currentGroupId === groupId) {
        fireAndForget(groupState.loadAdminExtras(groupId));
        if (type === 'member.invite_accepted') fireAndForget(groupState.loadMembers(groupId));
      }
      break;

    case 'expense.created':
    case 'expense.edited':
    case 'expense.deleted':
    case 'payment.recorded':
    case 'payment.received':
      if (tripId && tripState.currentTripId === tripId) {
        fireAndForget(tripState.refreshCurrentTrip());
      }
      fireAndForget(groupState.loadBalanceSummary());
      break;

    case 'trip.closed':
    case 'trip.cleared':
    case 'trip.deleted':
      if (groupId && tripState.currentTripsGroupId === groupId) {
        fireAndForget(tripState.loadTrips(groupId, { quiet: true }));
      }
      if (tripId && tripState.currentTripId === tripId && type !== 'trip.deleted') {
        fireAndForget(tripState.refreshCurrentTrip());
      }
      fireAndForget(groupState.loadBalanceSummary());
      break;

    default:
      break;
  }
}
