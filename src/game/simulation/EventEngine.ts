import { SimulationEvent } from '../../types/simulation';
import { SeededRandom } from '../../utils/seedRandom';

const POSSIBLE_EVENTS = [
  {
    title: 'Tâm lý thị trường chung khởi sắc',
    description: 'Dòng tiền nội tăng cường mua vào, tâm lý nhà đầu tư lạc quan kéo chỉ số lan tỏa tích cực.',
    severity: 'low' as const,
    impact: 0.015,
    duration: 12,
  },
  {
    title: 'Áp lực chốt lời ngắn hạn gia tăng',
    description: 'Nhà đầu tư thực hiện hiện thực hóa lợi nhuận sau chuỗi ngày tăng điểm, thanh khoản có xu hướng rung lắc.',
    severity: 'low' as const,
    impact: -0.012,
    duration: 10,
  },
  {
    title: 'Sóng tăng trưởng nhóm Công nghệ & Viễn thông',
    description: 'Kỳ vọng đột phá trong dịch vụ số và đơn hàng xuất khẩu phần mềm thúc đẩy nhóm công nghệ.',
    affectedSector: 'Công nghệ thông tin',
    severity: 'medium' as const,
    impact: 0.028,
    duration: 15,
  },
  {
    title: 'Dòng tiền luân chuyển vào cổ phiếu Ngân hàng',
    description: 'Thanh khoản tăng mạnh tại các cổ phiếu ngân hàng hàng đầu, đóng vai trò lực đỡ vững chắc cho chỉ số.',
    affectedSector: 'Tài chính - Ngân hàng',
    severity: 'medium' as const,
    impact: 0.02,
    duration: 14,
  },
  {
    title: 'Biến động mạnh tại nhóm Cổ phiếu Chu kỳ & Thép',
    description: 'Giá nguyên vật liệu quốc tế có diễn biến khó lường khiến nhóm sản xuất rung lắc với biên độ rộng.',
    affectedSector: 'Nguyên vật liệu - Thép',
    severity: 'medium' as const,
    impact: -0.018,
    duration: 10,
  },
  {
    title: 'Khối ngoại đảo chiều bán ròng nhẹ',
    description: 'Giao dịch khối ngoại ghi nhận áp lực bán tại một số mã vốn hóa lớn trước kỳ cơ cấu danh mục.',
    severity: 'low' as const,
    impact: -0.008,
    duration: 8,
  },
  {
    title: 'Đột biến thanh khoản trên toàn thị trường',
    description: 'Lực cầu bắt đáy hấp thụ tốt lượng cung bán giá thấp, độ rộng thị trường phân hóa.',
    severity: 'low' as const,
    impact: 0.01,
    duration: 12,
  },
  {
    title: 'Xu hướng dòng tiền phòng thủ vào hàng tiêu dùng',
    description: 'Nhà đầu tư cơ cấu tỷ trọng hướng vào các doanh nghiệp chi trả cổ tức cao và doanh thu ổn định.',
    affectedSector: 'Hàng tiêu dùng thiết yếu',
    severity: 'low' as const,
    impact: 0.014,
    duration: 16,
  },
  {
    title: 'Thị trường Mỹ: Công nghệ bán dẫn bùng nổ',
    description: 'Nhu cầu chip trí tuệ nhân tạo và trung tâm dữ liệu tiếp tục kéo đà tăng của nhóm dẫn dắt.',
    affectedMarket: 'us',
    severity: 'high' as const,
    impact: 0.032,
    duration: 18,
  },
];

export class EventEngine {
  /**
   * Evaluates if a new random simulation event should trigger on this tick
   */
  public static maybeTriggerEvent(
    rng: SeededRandom,
    timestamp: string,
    marketId: string,
    existingActiveCount: number
  ): SimulationEvent | null {
    // Only generate when active events are below 3, with ~5% probability per tick
    if (existingActiveCount >= 3) return null;
    if (rng.next() > 0.06) return null;

    const template = POSSIBLE_EVENTS[rng.nextInt(0, POSSIBLE_EVENTS.length - 1)];

    return {
      id: `ev-${Date.now()}-${rng.nextInt(1000, 9999)}`,
      timestamp,
      title: template.title,
      description: template.description,
      severity: template.severity,
      affectedMarket: template.affectedMarket || marketId,
      affectedSector: template.affectedSector,
      impact: template.impact,
      duration: template.duration,
      remainingDuration: template.duration,
    };
  }

  /**
   * Updates durations of active events and purges expired ones
   */
  public static updateActiveEvents(activeEvents: SimulationEvent[]): {
    updatedActive: SimulationEvent[];
    expired: SimulationEvent[];
  } {
    const updatedActive: SimulationEvent[] = [];
    const expired: SimulationEvent[] = [];

    for (const ev of activeEvents) {
      const remaining = ev.remainingDuration - 1;
      if (remaining > 0) {
        updatedActive.push({
          ...ev,
          remainingDuration: remaining,
        });
      } else {
        expired.push(ev);
      }
    }

    return { updatedActive, expired };
  }
}
