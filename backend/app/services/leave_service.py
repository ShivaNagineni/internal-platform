from datetime import date, timedelta
from app.models.leave import Leave, LeaveStatus


def compute_business_days(start: date, end: date) -> float:
    total = 0.0
    current = start
    while current <= end:
        if current.weekday() < 5:
            total += 1.0
        current += timedelta(days=1)
    return total


async def get_who_is_out_today() -> list[Leave]:
    today = date.today()
    return await Leave.find(
        Leave.status == LeaveStatus.APPROVED,
        Leave.start_date <= today,
        Leave.end_date >= today,
    ).sort(+Leave.start_date).to_list()
