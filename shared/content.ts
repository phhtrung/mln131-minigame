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
    word: 'Bố mẹ và con',
    aliases: ['bố mẹ và con', 'cha mẹ và con'],
    explanation: 'Gia đình hạt nhân gồm vợ chồng và con cái, thường phù hợp hơn với nhịp sống đô thị và tính cơ động của lao động hiện đại.',
    takeaway: 'Cơ hội: riêng tư và tự chủ hơn. Thách thức: ít người chia sẻ việc chăm sóc, dễ cô lập khi gặp khủng hoảng.',
    quiz: {
      prompt: 'Điểm nổi bật của gia đình hạt nhân trong đô thị là gì?',
      options: ['Tăng tính cơ động và tự chủ', 'Luôn có nhiều thế hệ cùng sống', 'Xóa bỏ mọi mâu thuẫn', 'Không cần phân công lao động'],
      correctIndex: 0,
    },
  },
  {
    word: 'Bố mẹ cùng nấu ăn',
    aliases: ['bố mẹ cùng nấu ăn', 'cha mẹ cùng nấu ăn'],
    explanation: 'Bình đẳng giới trong gia đình là cùng chia sẻ quyền quyết định, thu nhập, việc nhà và chăm sóc; không đồng nghĩa với chia đôi máy móc mọi việc.',
    takeaway: 'Cơ hội: quan hệ tôn trọng và bền vững hơn. Thách thức: định kiến cũ vẫn làm việc nhà và gánh nặng cảm xúc phân bổ lệch.',
    quiz: {
      prompt: 'Biểu hiện đúng của bình đẳng giới trong gia đình là gì?',
      options: ['Cùng thương lượng và chia sẻ trách nhiệm', 'Một người quyết định mọi việc', 'Chỉ chia đều tiền lương', 'Né tránh nói về việc nhà'],
      correctIndex: 0,
    },
  },
  {
    word: 'Gọi video cho ông bà',
    aliases: ['gọi video cho ông bà', 'gọi điện video cho ông bà'],
    explanation: 'Mạng xã hội giúp các thành viên xa nhau giữ liên lạc, nhưng cũng có thể tạo so sánh, xao nhãng và xung đột nếu thiếu ranh giới số.',
    takeaway: 'Cơ hội: kết nối và hỗ trợ nhanh. Thách thức: cần quy ước sử dụng thiết bị, tôn trọng riêng tư và kiểm chứng thông tin.',
    quiz: {
      prompt: 'Cách dùng mạng xã hội có trách nhiệm trong gia đình là gì?',
      options: ['Thống nhất ranh giới và tôn trọng riêng tư', 'Đọc trộm mọi tin nhắn', 'Đăng mọi chuyện riêng tư', 'Cấm tuyệt đối mọi thiết bị'],
      correctIndex: 0,
    },
  },
  {
    word: 'Gia đình ở chung cư',
    aliases: ['gia đình ở chung cư', 'cả nhà ở chung cư'],
    explanation: 'Lối sống đô thị có nhịp độ nhanh, không gian sống nhỏ và lịch làm việc dài; gia đình cần thiết kế thời gian chất lượng thay vì chỉ ở cạnh nhau.',
    takeaway: 'Cơ hội: tiếp cận dịch vụ, giáo dục và việc làm. Thách thức: áp lực thời gian, chi phí và khoảng cách thế hệ.',
    quiz: {
      prompt: 'Gia đình đô thị nên ưu tiên điều gì để giữ gắn kết?',
      options: ['Thời gian chất lượng và phân công rõ', 'Tăng giờ làm không giới hạn', 'Mỗi người sống hoàn toàn riêng', 'Tránh mọi thay đổi công nghệ'],
      correctIndex: 0,
    },
  },
  {
    word: 'Ông bà, bố mẹ và con',
    aliases: ['ông bà bố mẹ và con', 'ông bà cha mẹ và con'],
    explanation: 'Gia đình nhiều thế hệ có ông bà, cha mẹ và con cháu cùng hoặc gần nhau; mạng lưới hỗ trợ rộng nhưng cần thương lượng không gian và quyền riêng tư.',
    takeaway: 'Cơ hội: chia sẻ chăm sóc và kinh nghiệm. Thách thức: khác biệt chuẩn mực, quyền quyết định và cách nuôi dạy.',
    quiz: {
      prompt: 'Điều gì giúp gia đình nhiều thế hệ vận hành hài hòa?',
      options: ['Thỏa thuận vai trò và ranh giới', 'Một thế hệ áp đặt', 'Không bàn về tiền bạc', 'Tách mọi người khỏi nhau'],
      correctIndex: 0,
    },
  },
  {
    word: 'Đám cưới',
    aliases: ['đám cưới', 'lễ cưới'],
    explanation: 'Hôn nhân tiến bộ dựa trên tự nguyện, bình đẳng, tôn trọng và trách nhiệm; tình yêu cần đi cùng năng lực đối thoại và giải quyết xung đột.',
    takeaway: 'Cơ hội: mỗi người được phát triển. Thách thức: kỳ vọng thay đổi nhanh và kỹ năng giao tiếp chưa theo kịp.',
    quiz: {
      prompt: 'Nền tảng của hôn nhân tiến bộ là gì?',
      options: ['Tự nguyện, bình đẳng và tôn trọng', 'Áp lực từ dư luận', 'Phụ thuộc hoàn toàn kinh tế', 'Im lặng khi có xung đột'],
      correctIndex: 0,
    },
  },
  {
    word: 'Cả nhà ôm nhau',
    aliases: ['cả nhà ôm nhau', 'gia đình ôm nhau'],
    explanation: 'Gia đình hạnh phúc không phải là không có mâu thuẫn; đó là khả năng chăm sóc, đối thoại, bảo vệ thành viên và cùng vượt qua biến đổi.',
    takeaway: 'Mục tiêu là ấm no, tiến bộ, hạnh phúc; cần cả điều kiện vật chất lẫn văn hóa ứng xử và chính sách xã hội hỗ trợ.',
    quiz: {
      prompt: 'Gia đình hạnh phúc nên được hiểu như thế nào?',
      options: ['Biết chăm sóc và cùng giải quyết mâu thuẫn', 'Không bao giờ bất đồng', 'Chỉ cần thu nhập cao', 'Không cần hỗ trợ xã hội'],
      correctIndex: 0,
    },
  },
  {
    word: 'Anh chị em',
    aliases: ['anh chị em', 'chị em', 'anh em'],
    explanation: 'Quan hệ huyết thống gắn những người có quan hệ tự nhiên như cha mẹ, con cái, anh chị em và ông bà, cháu.',
    takeaway: 'Đây là một trong ba mối quan hệ cấu thành gia đình, cùng với hôn nhân và nuôi dưỡng.',
    quiz: {
      prompt: 'Ví dụ nào là quan hệ huyết thống?',
      options: ['Ông bà và cháu', 'Hai người cùng tổ dân phố', 'Đồng nghiệp cùng cơ quan', 'Bạn học cùng lớp'],
      correctIndex: 0,
    },
  },
  {
    word: 'Mẹ cho bé ăn',
    aliases: ['mẹ cho bé ăn', 'mẹ cho con ăn'],
    explanation: 'Quan hệ nuôi dưỡng hình thành từ sự chăm sóc về vật chất và tinh thần; quan hệ cha mẹ nuôi, con nuôi được pháp luật công nhận.',
    takeaway: 'Nuôi dưỡng vừa là trách nhiệm, vừa là quyền lợi thiêng liêng; xã hội có thể chia sẻ nhưng không thay thế hoàn toàn.',
    quiz: {
      prompt: 'Điều gì làm nên quan hệ nuôi dưỡng trong gia đình?',
      options: ['Sự chăm sóc vật chất và tinh thần', 'Cùng làm việc một nơi', 'Cùng sống trong một khu phố', 'Cùng tham gia một câu lạc bộ'],
      correctIndex: 0,
    },
  },
  {
    word: 'Khu phố',
    aliases: ['khu phố', 'khu dân cư'],
    explanation: 'Gia đình là đơn vị cơ sở góp phần tạo nên xã hội; sự tồn tại của gia đình gắn với sản xuất và tái sản xuất đời sống.',
    takeaway: 'Gia đình và xã hội tác động qua lại: gia đình tốt góp phần làm xã hội tốt, còn xã hội tạo điều kiện cho gia đình phát triển.',
    quiz: {
      prompt: 'Vì sao gia đình được gọi là tế bào của xã hội?',
      options: ['Gia đình là đơn vị cơ sở tạo nên xã hội', 'Gia đình chỉ tồn tại ngoài xã hội', 'Gia đình thay thế mọi thiết chế xã hội', 'Mỗi gia đình hoạt động tách biệt với cộng đồng'],
      correctIndex: 0,
    },
  },
  {
    word: 'Ngôi nhà',
    aliases: ['ngôi nhà', 'căn nhà'],
    explanation: 'Gia đình là môi trường để mỗi người được yêu thương, nuôi dưỡng, chăm sóc, trưởng thành và phát triển.',
    takeaway: 'Sự yên ổn trong gia đình góp phần hình thành nhân cách, thể lực và trí lực của mỗi thành viên.',
    quiz: {
      prompt: 'Vai trò nào của gia đình gắn với hình ảnh tổ ấm?',
      options: ['Yêu thương, chăm sóc và giúp thành viên trưởng thành', 'Chỉ phân chia tài sản', 'Thay thế hoàn toàn trường học', 'Ngăn mọi thành viên tham gia xã hội'],
      correctIndex: 0,
    },
  },
  {
    word: 'Đưa con đi học',
    aliases: ['đưa con đi học', 'bố mẹ đưa con đi học'],
    explanation: 'Gia đình là cộng đồng xã hội đầu tiên, nơi mỗi người học và thực hiện các quan hệ xã hội; các tác động xã hội cũng đi vào đời sống qua gia đình.',
    takeaway: 'Gia đình có thể lọc bớt hoặc khuếch đại những ảnh hưởng tích cực và tiêu cực từ xã hội.',
    quiz: {
      prompt: 'Gia đình nối cá nhân với xã hội bằng cách nào?',
      options: ['Giúp thành viên học quan hệ xã hội và tiếp nhận tác động xã hội', 'Tách cá nhân khỏi mọi quan hệ xã hội', 'Chỉ truyền đạt thông tin từ nhà nước', 'Thay thế toàn bộ cộng đồng bên ngoài'],
      correctIndex: 0,
    },
  },
  {
    word: 'Em bé chào đời',
    aliases: ['em bé chào đời', 'bé chào đời'],
    explanation: 'Tái sản xuất con người đáp ứng nhu cầu duy trì nòi giống và cung cấp sức lao động cho xã hội.',
    takeaway: 'Đây là chức năng đặc thù của gia đình, nhưng việc thực hiện còn liên quan đến nhu cầu và chính sách xã hội.',
    quiz: {
      prompt: 'Chức năng tái sản xuất con người có ý nghĩa gì?',
      options: ['Duy trì nòi giống và góp phần bảo đảm sức lao động', 'Tổ chức việc mua sắm trong gia đình', 'Thay thế chức năng giáo dục của nhà trường', 'Quyết định mọi quan hệ xã hội'],
      correctIndex: 0,
    },
  },
  {
    word: 'Bố dạy con học',
    aliases: ['bố dạy con học', 'cha dạy con học'],
    explanation: 'Gia đình đem lại những hiểu biết đầu tiên và có ảnh hưởng bền vững; nhà trường và xã hội cùng giáo dục nhưng không thể thay thế hoàn toàn gia đình.',
    takeaway: 'Giáo dục gia đình cần gắn kết với giáo dục ở nhà trường và xã hội.',
    quiz: {
      prompt: 'Cách phối hợp giáo dục nào phù hợp với vai trò của gia đình?',
      options: ['Gắn giáo dục gia đình với nhà trường và xã hội', 'Khoán trắng việc giáo dục cho nhà trường', 'Tách trẻ khỏi mọi hoạt động xã hội', 'Coi cảm tính là phương pháp giáo dục duy nhất'],
      correctIndex: 0,
    },
  },
  {
    word: 'Bố mẹ đi làm',
    aliases: ['bố mẹ đi làm', 'cha mẹ đi làm'],
    explanation: 'Gia đình tham gia sản xuất, tái sản xuất sức lao động và tổ chức đời sống vật chất cho các thành viên.',
    takeaway: 'Điều kiện kinh tế có liên hệ với đời sống vật chất, tinh thần và khả năng chăm sóc trong gia đình.',
    quiz: {
      prompt: 'Điểm nào thuộc chức năng kinh tế của gia đình?',
      options: ['Tham gia sản xuất và bảo đảm đời sống vật chất', 'Chỉ tổ chức nghi lễ cộng đồng', 'Thay thế toàn bộ nền kinh tế xã hội', 'Chỉ quyết định việc học của trẻ'],
      correctIndex: 0,
    },
  },
  {
    word: 'Đi siêu thị',
    aliases: ['đi siêu thị', 'mua sắm ở siêu thị'],
    explanation: 'Gia đình sử dụng thu nhập và quỹ thời gian để đáp ứng nhu cầu thành viên, đồng thời tạo môi trường sống lành mạnh.',
    takeaway: 'Tiêu dùng hợp lý gắn với cả nguồn lực vật chất lẫn thời gian của gia đình.',
    quiz: {
      prompt: 'Gia đình tổ chức tiêu dùng hợp lý nên chú ý điều gì?',
      options: ['Sử dụng thu nhập và thời gian phù hợp', 'Chi tiêu không cần quan tâm thu nhập', 'Dành toàn bộ thời gian cho công việc', 'Bỏ qua nhu cầu của các thành viên'],
      correctIndex: 0,
    },
  },
  {
    word: 'Cháu dìu bà',
    aliases: ['cháu dìu bà', 'cháu dìu ông bà'],
    explanation: 'Chức năng tình cảm của gia đình bao gồm chăm sóc người già, người ốm và trẻ em, cả về vật chất lẫn tinh thần.',
    takeaway: 'Dịch vụ cộng đồng có thể hỗ trợ gia đình, nhất là khi dân số già hóa và gia đình ít thế hệ cùng sống.',
    quiz: {
      prompt: 'Theo tài liệu, chăm sóc người cao tuổi thuộc chức năng nào của gia đình?',
      options: ['Thỏa mãn nhu cầu tâm sinh lý và duy trì tình cảm', 'Tổ chức tiêu dùng', 'Tái sản xuất sức lao động', 'Thực hiện chức năng chính trị'],
      correctIndex: 0,
    },
  },
  {
    word: 'Cả nhà dọn nhà',
    aliases: ['cả nhà dọn nhà', 'gia đình dọn nhà'],
    explanation: 'Chia sẻ việc nhà và chăm sóc giúp giảm sự phân bổ bất bình đẳng về thời gian và trách nhiệm giữa các thành viên.',
    takeaway: 'Bình đẳng không phải chia đôi máy móc mọi việc, mà là cùng thương lượng và chia sẻ trách nhiệm phù hợp.',
    quiz: {
      prompt: 'Chia sẻ việc nhà bình đẳng nên dựa trên điều gì?',
      options: ['Cùng thương lượng và chia sẻ trách nhiệm', 'Mặc định mọi việc thuộc về phụ nữ', 'Chỉ chia sẻ khi có người ngoài nhắc', 'Một người quyết định và người kia làm hết'],
      correctIndex: 0,
    },
  },
  {
    word: 'Cầu hôn',
    aliases: ['cầu hôn', 'lời cầu hôn'],
    explanation: 'Hôn nhân tiến bộ xuất phát từ tình yêu và sự tự nguyện; quyền tự do kết hôn đi cùng trách nhiệm với nhau.',
    takeaway: 'Hôn nhân không nên bị quyết định bởi ép buộc, tính toán kinh tế hay địa vị xã hội.',
    quiz: {
      prompt: 'Nền tảng nào phù hợp với hôn nhân tự nguyện?',
      options: ['Tình yêu và sự tự nguyện của hai người', 'Sự ép buộc của cộng đồng', 'Tính toán địa vị xã hội', 'Quyết định đơn phương của họ hàng'],
      correctIndex: 0,
    },
  },
  {
    word: 'Nhẫn cưới',
    aliases: ['nhẫn cưới', 'cặp nhẫn cưới'],
    explanation: 'Hôn nhân tiến bộ dựa trên nguyên tắc một vợ một chồng, vợ chồng bình đẳng và tôn trọng lẫn nhau.',
    takeaway: 'Các nguyên tắc này được nêu trong Hiến pháp và Luật Hôn nhân và gia đình.',
    quiz: {
      prompt: 'Nguyên tắc nào gắn với chế độ hôn nhân tiến bộ ở Việt Nam?',
      options: ['Một vợ một chồng và vợ chồng bình đẳng', 'Một người có quyền quyết định tuyệt đối', 'Hôn nhân do gia đình ép buộc', 'Phân biệt quyền theo giới tính'],
      correctIndex: 0,
    },
  },
  {
    word: 'Bố mẹ trò chuyện',
    aliases: ['bố mẹ trò chuyện', 'cha mẹ trò chuyện'],
    explanation: 'Tôn trọng lẫn nhau là nguyên tắc trong quan hệ vợ chồng và là nền tảng để các thành viên đối thoại, cùng giải quyết bất đồng.',
    takeaway: 'Tôn trọng quyền riêng tư và lựa chọn của nhau giúp gia đình thích ứng với biến đổi.',
    quiz: {
      prompt: 'Khi có bất đồng, cách ứng xử nào thể hiện sự tôn trọng?',
      options: ['Lắng nghe và cùng trao đổi', 'Đọc trộm tin nhắn của nhau', 'Áp đặt quyết định bằng quyền lực', 'Đăng chuyện riêng tư lên mạng'],
      correctIndex: 0,
    },
  },
  {
    word: 'Bữa cơm gia đình',
    aliases: ['bữa cơm gia đình', 'bữa cơm sum họp'],
    explanation: 'Bữa cơm sum họp là một sinh hoạt văn hóa gia đình, nơi các thành viên có thể chia sẻ và duy trì kết nối.',
    takeaway: 'Những nếp sinh hoạt chung có thể nuôi dưỡng tình cảm trong nhịp sống hiện đại bận rộn.',
    quiz: {
      prompt: 'Bữa cơm sum họp thể hiện khía cạnh nào của gia đình?',
      options: ['Lưu giữ văn hóa và duy trì gắn kết', 'Thay thế mọi chức năng kinh tế', 'Bảo đảm không bao giờ có xung đột', 'Tách gia đình khỏi cộng đồng'],
      correctIndex: 0,
    },
  },
  {
    word: 'Tết Nguyên đán',
    aliases: ['tết nguyên đán', 'Tết', 'ngày Tết'],
    explanation: 'Tết là dịp sinh hoạt văn hóa quen thuộc, nơi gia đình lưu giữ và trao truyền những giá trị văn hóa dân tộc.',
    takeaway: 'Chức năng văn hóa của gia đình gồm lưu giữ, sáng tạo và thụ hưởng các giá trị văn hóa.',
    quiz: {
      prompt: 'Gia đình thực hiện chức năng văn hóa qua hoạt động nào?',
      options: ['Cùng gìn giữ phong tục ngày Tết', 'Chỉ quản lý thu nhập', 'Thay thế mọi cơ quan nhà nước', 'Ngăn các thế hệ chia sẻ truyền thống'],
      correctIndex: 0,
    },
  },
  {
    word: 'Hai nhà cạnh nhau',
    aliases: ['hai nhà cạnh nhau', 'hai ngôi nhà cạnh nhau'],
    explanation: 'Gia đình mở rộng biến thể có thể sống riêng nhưng vẫn ở gần, duy trì quan hệ hỗ trợ giữa các thế hệ.',
    takeaway: 'Cách sống này có thể kết hợp quyền riêng tư với sự chăm sóc và kết nối gia đình.',
    quiz: {
      prompt: 'Mô hình “ở riêng nhưng ở gần” thể hiện điều gì?',
      options: ['Sống riêng nhưng vẫn hỗ trợ giữa các thế hệ', 'Cắt đứt quan hệ với họ hàng', 'Bắt buộc mọi thế hệ sống chung', 'Chuyển toàn bộ chăm sóc cho nhà nước'],
      correctIndex: 0,
    },
  },
  {
    word: 'Bé dùng máy tính',
    aliases: ['bé dùng máy tính', 'trẻ dùng máy tính'],
    explanation: 'Trẻ sử dụng internet và mạng xã hội cần được cha mẹ hướng dẫn để nhận diện rủi ro, bắt nạt và xâm hại trực tuyến.',
    takeaway: 'Đồng hành số cần kỹ năng, đối thoại và tôn trọng trẻ; chỉ cấm thiết bị không giải quyết hết rủi ro.',
    quiz: {
      prompt: 'Cha mẹ nên làm gì để giúp trẻ an toàn trên mạng?',
      options: ['Hướng dẫn trẻ nhận diện rủi ro và sử dụng mạng an toàn', 'Đăng công khai mọi thông tin của trẻ', 'Đọc trộm mọi tin nhắn mà không trao đổi', 'Bỏ mặc trẻ tự xử lý mọi tình huống'],
      correctIndex: 0,
    },
  },
  {
    word: 'Tin nhắn',
    aliases: ['tin nhắn', 'tin nhắn điện thoại'],
    explanation: 'Thông tin xã hội, bao gồm tin giả và lừa đảo trực tuyến, có thể đi vào gia đình qua các kênh kết nối số.',
    takeaway: 'Gia đình nên kiểm chứng thông tin và hướng dẫn người thân nhận diện lừa đảo trước khi chia sẻ.',
    quiz: {
      prompt: 'Gia đình nên làm gì khi nhận được thông tin đáng ngờ trên mạng?',
      options: ['Kiểm chứng trước khi tin hoặc chia sẻ', 'Chuyển tiếp ngay cho mọi người', 'Cung cấp mật khẩu để xác minh', 'Coi mọi tin nhắn trong nhóm là chính xác'],
      correctIndex: 0,
    },
  },
  {
    word: 'Mẹ chăm bà và bé',
    aliases: ['mẹ chăm bà và bé', 'mẹ chăm bà và con'],
    explanation: 'Người ở độ tuổi trung niên có thể vừa chăm sóc cha mẹ già, vừa nuôi con nhỏ và đi làm.',
    takeaway: 'Dịch vụ chăm sóc cộng đồng và sự chia sẻ trách nhiệm giúp giảm gánh nặng dồn lên một thành viên.',
    quiz: {
      prompt: '“Thế hệ kẹp giữa” thường phải làm gì cùng lúc?',
      options: ['Chăm cha mẹ già, nuôi con nhỏ và đi làm', 'Chỉ chăm sóc bạn bè cùng tuổi', 'Không tham gia chăm sóc gia đình', 'Chỉ sống cùng một thế hệ'],
      correctIndex: 0,
    },
  },
  {
    word: 'Con gái đá bóng',
    aliases: ['con gái đá bóng', 'bé gái đá bóng'],
    explanation: 'Định kiến giới như tư tưởng trọng nam khinh nữ có thể tạo bất bình đẳng trong chăm sóc, việc nhà và cơ hội của thành viên.',
    takeaway: 'Thay đổi luật pháp cần đi cùng thay đổi văn hóa và cách phân chia trách nhiệm trong đời sống hằng ngày.',
    quiz: {
      prompt: 'Ví dụ nào thể hiện định kiến giới được nêu trong tài liệu?',
      options: ['Cho rằng gia đình nhất thiết phải có con trai', 'Cùng chia sẻ việc chăm sóc', 'Tôn trọng lựa chọn nghề nghiệp', 'Cùng bàn bạc việc gia đình'],
      correctIndex: 0,
    },
  },
  {
    word: 'Cảnh sát',
    aliases: ['cảnh sát', 'công an'],
    explanation: 'Bạo lực gia đình có thể bị che giấu; pháp luật quy định việc phòng ngừa, bảo vệ và hỗ trợ người bị bạo lực.',
    takeaway: 'Cần tăng khả năng tiếp cận trợ giúp và dịch vụ hỗ trợ an toàn cho người bị bạo lực.',
    quiz: {
      prompt: 'Luật Phòng, chống bạo lực gia đình tập trung vào điều gì?',
      options: ['Phòng ngừa, bảo vệ và hỗ trợ người bị bạo lực', 'Giữ kín mọi vụ việc bằng mọi giá', 'Chỉ hòa giải mà không bảo vệ nạn nhân', 'Chuyển trách nhiệm hoàn toàn cho trẻ em'],
      correctIndex: 0,
    },
  },
  {
    word: 'Chụp ảnh cưới',
    aliases: ['chụp ảnh cưới', 'chụp hình cưới'],
    explanation: 'Chuẩn bị trước hôn nhân có thể trang bị kỹ năng giao tiếp, quản lý tài chính và hiểu biết pháp luật cho các cặp đôi.',
    takeaway: 'Tài liệu nêu mục tiêu giáo dục, tư vấn trước hôn nhân cho nam nữ thanh niên.',
    quiz: {
      prompt: 'Tư vấn tiền hôn nhân có thể giúp cặp đôi chuẩn bị điều gì?',
      options: ['Kỹ năng giao tiếp, tài chính và hiểu biết pháp luật', 'Cách né tránh mọi trách nhiệm', 'Cách quyết định thay cho người kia', 'Một cam kết rằng sẽ không bao giờ bất đồng'],
      correctIndex: 0,
    },
  },
  {
    word: 'Nhà trẻ',
    aliases: ['nhà trẻ', 'dịch vụ trông trẻ'],
    explanation: 'Nhà trẻ và dịch vụ chăm sóc là những chức năng từng được thực hiện trong gia đình mà xã hội có thể chia sẻ.',
    takeaway: 'Dịch vụ phù hợp giúp gia đình, đặc biệt là phụ nữ, giảm gánh nặng chăm sóc không được trả công.',
    quiz: {
      prompt: 'Nhà trẻ hỗ trợ gia đình theo cách nào?',
      options: ['Chia sẻ một phần công việc chăm sóc trẻ', 'Thay thế hoàn toàn tình cảm gia đình', 'Quyết định số con cho mỗi gia đình', 'Loại bỏ trách nhiệm nuôi dạy của cha mẹ'],
      correctIndex: 0,
    },
  },
  {
    word: 'Bố đi làm xa',
    aliases: ['bố đi làm xa', 'cha đi làm xa'],
    explanation: 'Di cư lao động và đô thị hóa làm thay đổi nơi ở, thời gian và cách các thành viên duy trì quan hệ gia đình.',
    takeaway: 'Gia đình có thể duy trì kết nối qua hỗ trợ từ xa, đồng thời cần dịch vụ xã hội ở nơi người lao động sinh sống.',
    quiz: {
      prompt: 'Di cư lao động có thể làm thay đổi điều gì trong đời sống gia đình?',
      options: ['Nơi ở và cách các thành viên duy trì kết nối', 'Nguyên tắc một vợ một chồng', 'Mọi quyền và nghĩa vụ gia đình', 'Nhu cầu được chăm sóc của trẻ em'],
      correctIndex: 0,
    },
  },
  {
    word: 'Quầy hàng gia đình',
    aliases: ['quầy hàng gia đình', 'gia đình bán hàng'],
    explanation: 'Kinh tế hộ, hộ kinh doanh cá thể và kinh tế trang trại là những biểu hiện cụ thể của chức năng kinh tế gia đình.',
    takeaway: 'Gia đình vừa tham gia sản xuất, vừa tổ chức tiêu dùng và tái sản xuất sức lao động.',
    quiz: {
      prompt: 'Ví dụ nào trong tài liệu thể hiện kinh tế gia đình?',
      options: ['Hộ kinh doanh cá thể', 'Nhóm chat gia đình', 'Ngày giỗ trong gia đình', 'Quan hệ ông bà và cháu'],
      correctIndex: 0,
    },
  },
  {
    word: 'Giấy khen',
    aliases: ['giấy khen', 'bằng khen'],
    explanation: 'Phong trào xây dựng gia đình văn hóa hướng tới gia đình no ấm, tiến bộ, hạnh phúc; việc bình xét cần thực chất.',
    takeaway: 'Tiêu chí nên thiết thực, dân chủ và tránh chạy theo thành tích hình thức.',
    quiz: {
      prompt: 'Cách triển khai phong trào gia đình văn hóa nào phù hợp?',
      options: ['Dùng tiêu chí thiết thực và bình xét dân chủ', 'Chạy theo số lượng danh hiệu', 'Đánh giá chỉ bằng thu nhập', 'Bỏ qua hoàn toàn đời sống thành viên'],
      correctIndex: 0,
    },
  },
  {
    word: 'Hàng xóm giúp nhau',
    aliases: ['hàng xóm giúp nhau', 'hàng xóm giúp đỡ nhau'],
    explanation: 'Dịch vụ chăm sóc dựa vào cộng đồng có thể hỗ trợ gia đình khi chăm sóc người cao tuổi và các thành viên cần trợ giúp.',
    takeaway: 'Trách nhiệm gia đình và dịch vụ xã hội cần bổ trợ nhau, nhất là khi gia đình hạt nhân phổ biến hơn.',
    quiz: {
      prompt: 'Dịch vụ chăm sóc cộng đồng có vai trò gì?',
      options: ['Hỗ trợ gia đình chăm sóc thành viên cần trợ giúp', 'Thay thế hoàn toàn mọi quan hệ gia đình', 'Chỉ phục vụ hoạt động giải trí', 'Ngăn các thành viên chăm sóc lẫn nhau'],
      correctIndex: 0,
    },
  },
  {
    word: 'Mẹ đọc sách cho con',
    aliases: ['mẹ đọc sách cho con', 'mẹ đọc sách cho bé'],
    explanation: 'Những hiểu biết đầu tiên từ gia đình thường để lại dấu ấn sâu đậm; cha mẹ cần có kiến thức và phương pháp giáo dục phù hợp.',
    takeaway: 'Giáo dục gia đình hiệu quả khi phối hợp với nhà trường và xã hội, không phủ nhận vai trò của nhau.',
    quiz: {
      prompt: 'Vì sao giáo dục gia đình có ý nghĩa lâu dài?',
      options: ['Những hiểu biết đầu tiên thường để lại dấu ấn bền vững', 'Gia đình có thể thay thế mọi trường học', 'Trẻ chỉ học được từ mạng xã hội', 'Giáo dục không liên quan đến cách nuôi dạy'],
      correctIndex: 0,
    },
  },
];
