export type RoundContent = {
  word: string;
  aliases: string[];
  explanation: string;
  takeaway: string;
  quiz: {
    prompt: string;
    options: string[];
    correctIndex: number;
  };
};

export const ROUND_CONTENT: RoundContent[] = [
  {
    word: 'Gia đình hạt nhân',
    aliases: ['gia đình hạt nhân', 'hạt nhân'],
    explanation: 'Gia đình hạt nhân gồm vợ chồng và con cái, thường phù hợp hơn với nhịp sống đô thị và tính cơ động của lao động hiện đại.',
    takeaway: 'Cơ hội: riêng tư và tự chủ hơn. Thách thức: ít người chia sẻ việc chăm sóc, dễ cô lập khi gặp khủng hoảng.',
    quiz: {
      prompt: 'Điểm nổi bật của gia đình hạt nhân trong đô thị là gì?',
      options: ['Tăng tính cơ động và tự chủ', 'Luôn có nhiều thế hệ cùng sống', 'Xóa bỏ mọi mâu thuẫn', 'Không cần phân công lao động'],
      correctIndex: 0,
    },
  },
  {
    word: 'Bình đẳng giới',
    aliases: ['bình đẳng giới', 'bình đẳng', 'đẳng giới'],
    explanation: 'Bình đẳng giới trong gia đình là cùng chia sẻ quyền quyết định, thu nhập, việc nhà và chăm sóc; không đồng nghĩa với chia đôi máy móc mọi việc.',
    takeaway: 'Cơ hội: quan hệ tôn trọng và bền vững hơn. Thách thức: định kiến cũ vẫn làm việc nhà và gánh nặng cảm xúc phân bổ lệch.',
    quiz: {
      prompt: 'Biểu hiện đúng của bình đẳng giới trong gia đình là gì?',
      options: ['Cùng thương lượng và chia sẻ trách nhiệm', 'Một người quyết định mọi việc', 'Chỉ chia đều tiền lương', 'Né tránh nói về việc nhà'],
      correctIndex: 0,
    },
  },
  {
    word: 'Mạng xã hội',
    aliases: ['mạng xã hội', 'social media', 'mạng'],
    explanation: 'Mạng xã hội giúp các thành viên xa nhau giữ liên lạc, nhưng cũng có thể tạo so sánh, xao nhãng và xung đột nếu thiếu ranh giới số.',
    takeaway: 'Cơ hội: kết nối và hỗ trợ nhanh. Thách thức: cần quy ước sử dụng thiết bị, tôn trọng riêng tư và kiểm chứng thông tin.',
    quiz: {
      prompt: 'Cách dùng mạng xã hội có trách nhiệm trong gia đình là gì?',
      options: ['Thống nhất ranh giới và tôn trọng riêng tư', 'Đọc trộm mọi tin nhắn', 'Đăng mọi chuyện riêng tư', 'Cấm tuyệt đối mọi thiết bị'],
      correctIndex: 0,
    },
  },
  {
    word: 'Lối sống đô thị',
    aliases: ['lối sống đô thị', 'đô thị', 'sống đô thị'],
    explanation: 'Lối sống đô thị có nhịp độ nhanh, không gian sống nhỏ và lịch làm việc dài; gia đình cần thiết kế thời gian chất lượng thay vì chỉ ở cạnh nhau.',
    takeaway: 'Cơ hội: tiếp cận dịch vụ, giáo dục và việc làm. Thách thức: áp lực thời gian, chi phí và khoảng cách thế hệ.',
    quiz: {
      prompt: 'Gia đình đô thị nên ưu tiên điều gì để giữ gắn kết?',
      options: ['Thời gian chất lượng và phân công rõ', 'Tăng giờ làm không giới hạn', 'Mỗi người sống hoàn toàn riêng', 'Tránh mọi thay đổi công nghệ'],
      correctIndex: 0,
    },
  },
  {
    word: 'Gia đình nhiều thế hệ',
    aliases: ['gia đình nhiều thế hệ', 'nhiều thế hệ', 'đa thế hệ'],
    explanation: 'Gia đình nhiều thế hệ có ông bà, cha mẹ và con cháu cùng hoặc gần nhau; mạng lưới hỗ trợ rộng nhưng cần thương lượng không gian và quyền riêng tư.',
    takeaway: 'Cơ hội: chia sẻ chăm sóc và kinh nghiệm. Thách thức: khác biệt chuẩn mực, quyền quyết định và cách nuôi dạy.',
    quiz: {
      prompt: 'Điều gì giúp gia đình nhiều thế hệ vận hành hài hòa?',
      options: ['Thỏa thuận vai trò và ranh giới', 'Một thế hệ áp đặt', 'Không bàn về tiền bạc', 'Tách mọi người khỏi nhau'],
      correctIndex: 0,
    },
  },
  {
    word: 'Hôn nhân tiến bộ',
    aliases: ['hôn nhân tiến bộ', 'hôn nhân', 'tiến bộ'],
    explanation: 'Hôn nhân tiến bộ dựa trên tự nguyện, bình đẳng, tôn trọng và trách nhiệm; tình yêu cần đi cùng năng lực đối thoại và giải quyết xung đột.',
    takeaway: 'Cơ hội: mỗi người được phát triển. Thách thức: kỳ vọng thay đổi nhanh và kỹ năng giao tiếp chưa theo kịp.',
    quiz: {
      prompt: 'Nền tảng của hôn nhân tiến bộ là gì?',
      options: ['Tự nguyện, bình đẳng và tôn trọng', 'Áp lực từ dư luận', 'Phụ thuộc hoàn toàn kinh tế', 'Im lặng khi có xung đột'],
      correctIndex: 0,
    },
  },
  {
    word: 'Gia đình hạnh phúc',
    aliases: ['gia đình hạnh phúc', 'hạnh phúc'],
    explanation: 'Gia đình hạnh phúc không phải là không có mâu thuẫn; đó là khả năng chăm sóc, đối thoại, bảo vệ thành viên và cùng vượt qua biến đổi.',
    takeaway: 'Mục tiêu là ấm no, tiến bộ, hạnh phúc; cần cả điều kiện vật chất lẫn văn hóa ứng xử và chính sách xã hội hỗ trợ.',
    quiz: {
      prompt: 'Gia đình hạnh phúc nên được hiểu như thế nào?',
      options: ['Biết chăm sóc và cùng giải quyết mâu thuẫn', 'Không bao giờ bất đồng', 'Chỉ cần thu nhập cao', 'Không cần hỗ trợ xã hội'],
      correctIndex: 0,
    },
  },
];
