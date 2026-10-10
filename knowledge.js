// ================================================================
//  knowledge.js — 大一计算机课程知识库
//  5门课程、25个知识点，每项含讲义/例题/练习/资源链接
// ================================================================

var knowledgeBase = [
  { id:'math-001', course:'高等数学', title:'函数极限与连续',
    summary:'极限的定义、四则运算法则、两个重要极限、无穷小比较、函数连续性判断与间断点分类',
    content:'【核心概念】极限的定义、四则运算法则、两个重要极限、无穷小比较、函数连续性判断与间断点分类。详细讲义内容请参考课程教材与课堂笔记。',
    examples:['求极限 lim(x→0) (sin3x)/x','判断函数 f(x)=|x|/x 在x=0处的连续性'],
    exercises:['计算 lim(x→∞) (2x+3)/(x-1)','讨论 f(x)=(x²-1)/(x-1) 在x=1处的连续性'],
    resources:['核心讲义','典型例题20道','章节测试卷'],
    resourceLinks:[{title:'高等数学MOOC课程',url:'https://kb.example.com/math-001'}],
    difficulty:'基础', tags:['极限','连续','无穷小'] },
  { id:'math-002', course:'高等数学', title:'一元函数微分学',
    summary:'导数定义与几何意义、求导法则、高阶导数、隐函数与参数方程求导、微分中值定理与洛必达法则',
    content:'【核心概念】导数定义、求导法则、高阶导数、隐函数与参数方程求导、微分中值定理与洛必达法则。详细讲义内容请参考课程教材与课堂笔记。',
    examples:['求 y=x³+2x²-5x+1 的导数','用洛必达法则求 lim(x→0) (e^x-1)/x'],
    exercises:['求 y=ln(cosx) 的导数','利用拉格朗日中值定理证明不等式'],
    resources:['公式手册','求导专项练习','洛必达法则专题'],
    resourceLinks:[{title:'高等数学MOOC课程',url:'https://kb.example.com/math-002'}],
    difficulty:'重点', tags:['导数','微分','求导','洛必达'] },
  { id:'math-003', course:'高等数学', title:'不定积分与定积分',
    summary:'原函数与不定积分、换元积分法、分部积分法、牛顿-莱布尼茨公式、定积分的几何应用',
    content:'【核心概念】原函数与不定积分、换元积分法、分部积分法、牛顿-莱布尼茨公式、定积分的几何应用。详细讲义内容请参考课程教材与课堂笔记。',
    examples:['计算 ∫x·e^x dx（分部积分）','求 ∫sin²x dx'],
    exercises:['计算 ∫(2x+1)^(10) dx','求 ∫lnx dx'],
    resources:['积分公式表','换元法练习册','定积分应用题集'],
    resourceLinks:[{title:'高等数学MOOC课程',url:'https://kb.example.com/math-003'}],
    difficulty:'难点', tags:['积分','换元','分部积分','定积分'] },
  { id:'math-004', course:'高等数学', title:'多元函数微分学',
    summary:'偏导数与全微分、链式法则、隐函数求导、方向导数与梯度、多元函数极值与条件极值',
    content:'【核心概念】偏导数与全微分、链式法则、隐函数求导、方向导数与梯度、多元函数极值与条件极值。详细讲义内容请参考课程教材与课堂笔记。',
    examples:['求 z=x²+y² 的偏导数和全微分','求 f(x,y)=x³+y³-3xy 的极值点'],
    exercises:['求 z=e^(xy) 的偏导数','判断 f(x,y)=x²-xy+y² 的极值'],
    resources:['多元函数讲义','偏导数练习册','极值问题专题'],
    resourceLinks:[{title:'高等数学MOOC课程',url:'https://kb.example.com/math-004'}],
    difficulty:'重点', tags:['偏导数','全微分','梯度','极值'] },
  { id:'math-005', course:'高等数学', title:'微分方程',
    summary:'可分离变量方程、一阶线性微分方程、二阶常系数齐次/非齐次方程、微分方程的应用建模',
    content:'【核心概念】可分离变量方程、一阶线性微分方程、二阶常系数齐次/非齐次方程、微分方程的应用建模。详细讲义内容请参考课程教材与课堂笔记。',
    examples:['求解 dy/dx=2xy','求 y’ +2xy=x 的通解'],
    exercises:['解 dy/dx=y/(x+1)','求 y’ +y/x=x² 的通解'],
    resources:['微分方程讲义','一阶方程题库','二阶方程专题'],
    resourceLinks:[{title:'高等数学MOOC课程',url:'https://kb.example.com/math-005'}],
    difficulty:'难点', tags:['微分方程','通解','特解','特征方程'] },
  { id:'math-006', course:'高等数学', title:'无穷级数',
    summary:'常数项级数敛散性判别、正项级数审敛法、交错级数、幂级数与收敛半径、泰勒级数展开',
    content:'【核心概念】常数项级数敛散性判别、正项级数审敛法、交错级数、幂级数与收敛半径、泰勒级数展开。详细讲义内容请参考课程教材与课堂笔记。',
    examples:['判断级数 ∑1/n² 的敛散性','将 f(x)=e^x 展开为麦克劳林级数'],
    exercises:['用比值法判断 ∑n/2^n 的敛散性','将 sinx 展开为幂级数'],
    resources:['级数理论讲义','审敛法速查表','幂级数练习题'],
    resourceLinks:[{title:'高等数学MOOC课程',url:'https://kb.example.com/math-006'}],
    difficulty:'难点', tags:['级数','收敛','幂级数','泰勒级数'] },
  { id:'eng-001', course:'大学英语', title:'四级核心词汇与阅读技巧',
    summary:'高频词汇词根记忆法、仔细阅读三步法(定位-理解-排除)、长篇阅读段落匹配技巧',
    content:'【核心概念】高频词汇词根记忆法、仔细阅读三步法(定位-理解-排除)、长篇阅读段落匹配技巧。详细讲义内容请参考课程教材与课堂笔记。',
    examples:['定位练习：在段落中找出关键词','词根练习：用"-able"后缀构造5个形容词'],
    exercises:['完成1篇仔细阅读（5题/8分钟）','记忆50个高频词汇'],
    resources:['核心词汇表','阅读真题精讲','每日一练题库'],
    resourceLinks:[{title:'大学英语MOOC课程',url:'https://kb.example.com/eng-001'}],
    difficulty:'重点', tags:['词汇','阅读','四级','词根'] },
  { id:'eng-002', course:'大学英语', title:'听力理解与写作模板',
    summary:'听力关键词抓取与预读技巧、四级写作万能模板(现象解释/对比选择/问题解决型)',
    content:'【核心概念】听力关键词抓取与预读技巧、四级写作万能模板(现象解释/对比选择/问题解决型)。详细讲义内容请参考课程教材与课堂笔记。',
    examples:['听力：短对话关键词抓取练习','写作：用模板写一篇"手机依赖"作文'],
    exercises:['完成1套听力真题','写一篇对比选择型作文(120词)'],
    resources:['听力真题音频','写作模板集','高分范文10篇'],
    resourceLinks:[{title:'大学英语MOOC课程',url:'https://kb.example.com/eng-002'}],
    difficulty:'重点', tags:['听力','写作','模板'] },
  { id:'eng-003', course:'大学英语', title:'翻译技巧与语法精讲',
    summary:'汉译英主谓确定与时态一致、三大从句(名/定/状)与长难句分析、虚拟语气与倒装',
    content:'【核心概念】汉译英主谓确定与时态一致、三大从句(名/定/状)与长难句分析、虚拟语气与倒装。详细讲义内容请参考课程教材与课堂笔记。',
    examples:['翻译：将"学外语需要长期坚持"译为英文','语法：分析长句的从句结构'],
    exercises:['翻译5个中文句子','完成虚拟语气专项练习'],
    resources:['翻译专项练习','语法思维导图','从句拆解训练'],
    resourceLinks:[{title:'大学英语MOOC课程',url:'https://kb.example.com/eng-003'}],
    difficulty:'难点', tags:['翻译','语法','从句','虚拟语气'] },
  { id:'eng-004', course:'大学英语', title:'快速阅读与完形填空',
    summary:'扫读(Skimming)与略读(Scanning)技巧、完形填空上下文推理、高频固定搭配',
    content:'【核心概念】扫读(Skimming)与略读(Scanning)技巧、完形填空上下文推理、高频固定搭配。详细讲义内容请参考课程教材与课堂笔记。',
    examples:['快速阅读：3分钟内找出文章主旨','完形填空：根据上下文选择连接词'],
    exercises:['完成1篇快速阅读','记忆50组固定搭配'],
    resources:['快速阅读训练','完形填空真题','固定搭配手册'],
    resourceLinks:[{title:'大学英语MOOC课程',url:'https://kb.example.com/eng-004'}],
    difficulty:'基础', tags:['阅读','完形','搭配','快速阅读'] },
  { id:'eng-005', course:'大学英语', title:'学术英语与论文写作',
    summary:'学术词汇特点、论文结构(IMRaD)、写作规范(APA引用格式)、图表描述技巧',
    content:'【核心概念】学术词汇特点、论文结构(IMRaD)、写作规范(APA引用格式)、图表描述技巧。详细讲义内容请参考课程教材与课堂笔记。',
    examples:['分析一篇学术论文的结构','描述图表：柱状图变化趋势'],
    exercises:['写一篇200词英文摘要','完成图表描述练习'],
    resources:['学术写作手册','APA格式指南','图表描述模板'],
    resourceLinks:[{title:'大学英语MOOC课程',url:'https://kb.example.com/eng-005'}],
    difficulty:'重点', tags:['学术写作','论文','摘要','图表描述'] },
  { id:'code-001', course:'程序设计基础', title:'C语言基础语法与数据类型',
    summary:'程序结构、变量与命名规范、基本数据类型(int/float/char)、输入输出函数、运算符与表达式',
    content:'【核心概念】程序结构、变量与命名规范、基本数据类型(int/float/char)、输入输出函数、运算符与表达式。详细讲义内容请参考课程教材与课堂笔记。',
    examples:['编写Hello World程序','输入两个整数，输出它们的和'],
    exercises:['编写华氏温度转摄氏温度的程序','输入年份，判断是否为闰年'],
    resources:['语法速查表','入门编程题10道','上机实验指导'],
    resourceLinks:[{title:'程序设计基础MOOC课程',url:'https://kb.example.com/code-001'}],
    difficulty:'基础', tags:['语法','变量','数据类型'] },
  { id:'code-002', course:'程序设计基础', title:'循环结构与数组',
    summary:'for/while循环、循环嵌套、break/continue、一维/二维数组操作、冒泡排序与选择排序',
    content:'【核心概念】for/while循环、循环嵌套、break/continue、一维/二维数组操作、冒泡排序与选择排序。详细讲义内容请参考课程教材与课堂笔记。',
    examples:['用for循环打印九九乘法表','用选择排序对10个数升序排列'],
    exercises:['打印100以内的所有素数','用冒泡排序对数组排序'],
    resources:['循环专项习题','数组经典算法','实验报告模板'],
    resourceLinks:[{title:'程序设计基础MOOC课程',url:'https://kb.example.com/code-002'}],
    difficulty:'重点', tags:['循环','数组','排序','查找'] },
  { id:'code-003', course:'程序设计基础', title:'函数与指针',
    summary:'函数定义与调用、值传递vs地址传递、递归函数、指针基础与运算、数组与指针关系',
    content:'【核心概念】函数定义与调用、值传递vs地址传递、递归函数、指针基础与运算、数组与指针关系。详细讲义内容请参考课程教材与课堂笔记。',
    examples:['编写swap函数交换两个变量的值','用递归计算阶乘'],
    exercises:['用递归实现斐波那契数列','用指针实现字符串反转'],
    resources:['函数专题讲义','指针易错题汇编','编程作业参考答案'],
    resourceLinks:[{title:'程序设计基础MOOC课程',url:'https://kb.example.com/code-003'}],
    difficulty:'难点', tags:['函数','指针','递归','地址'] },
  { id:'code-004', course:'程序设计基础', title:'结构体与文件操作',
    summary:'结构体定义与使用、typedef类型别名、文件打开/读写/关闭(fopen/fprintf/fscanf/fclose)',
    content:'【核心概念】结构体定义与使用、typedef类型别名、文件打开/读写/关闭(fopen/fprintf/fscanf/fclose)。详细讲义内容请参考课程教材与课堂笔记。',
    examples:['定义学生结构体并输入/输出','将学生信息写入文件'],
    exercises:['定义图书结构体并实现借阅功能','实现简单的学生成绩管理系统'],
    resources:['结构体专题讲义','文件操作实验指导','综合编程项目'],
    resourceLinks:[{title:'程序设计基础MOOC课程',url:'https://kb.example.com/code-004'}],
    difficulty:'重点', tags:['结构体','文件','typedef'] },
  { id:'code-005', course:'程序设计基础', title:'基础算法与数据结构',
    summary:'时间复杂度概念、链表/栈/队列基本操作、常用排序算法、贪心/分治/动态规划入门',
    content:'【核心概念】时间复杂度概念、链表/栈/队列基本操作、常用排序算法、贪心/分治/动态规划入门。详细讲义内容请参考课程教材与课堂笔记。',
    examples:['实现单链表的创建与遍历','用栈实现括号匹配'],
    exercises:['实现单链表反转','用队列实现广度优先搜索'],
    resources:['算法导论讲义','数据结构可视化','LeetCode入门题集'],
    resourceLinks:[{title:'程序设计基础MOOC课程',url:'https://kb.example.com/code-005'}],
    difficulty:'难点', tags:['算法','数据结构','链表','排序'] },
  { id:'cs-001', course:'计算机导论', title:'计算机系统概述',
    summary:'冯·诺依曼体系结构、硬件组成(CPU/内存/存储/I/O)、指令执行周期、进制转换(二/八/十/十六)',
    content:'【核心概念】冯·诺依曼体系结构、硬件组成(CPU/内存/存储/I/O)、指令执行周期、进制转换(二/八/十/十六)。详细讲义内容请参考课程教材与课堂笔记。',
    examples:['将十进制数 156 转为二进制','解释计算机执行 a=b+c 的过程'],
    exercises:['完成5道进制转换题','画出冯·诺依曼体系结构图'],
    resources:['计算机组成原理讲义','进制转换练习','硬件知识图谱'],
    resourceLinks:[{title:'计算机导论MOOC课程',url:'https://kb.example.com/cs-001'}],
    difficulty:'基础', tags:['冯诺依曼','CPU','进制','硬件'] },
  { id:'cs-002', course:'计算机导论', title:'操作系统基础',
    summary:'OS功能与分类、进程管理(状态/调度)、内存管理(分页/分段/虚拟内存)、文件系统与常用命令',
    content:'【核心概念】OS功能与分类、进程管理(状态/调度)、内存管理(分页/分段/虚拟内存)、文件系统与常用命令。详细讲义内容请参考课程教材与课堂笔记。',
    examples:['在任务管理器中观察进程状态','使用命令行创建/删除文件'],
    exercises:['列出5个常用Windows/Linux命令','画出进程三状态转换图'],
    resources:['操作系统概论讲义','命令行速查表','进程管理实验'],
    resourceLinks:[{title:'计算机导论MOOC课程',url:'https://kb.example.com/cs-002'}],
    difficulty:'重点', tags:['操作系统','进程','内存管理','文件系统'] },
  { id:'cs-003', course:'计算机导论', title:'计算机网络基础',
    summary:'TCP/IP四层模型、IP地址与子网掩码、TCP/UDP协议对比、HTTP/HTTPS与DNS域名解析',
    content:'【核心概念】TCP/IP四层模型、IP地址与子网掩码、TCP/UDP协议对比、HTTP/HTTPS与DNS域名解析。详细讲义内容请参考课程教材与课堂笔记。',
    examples:['用ping命令测试网络连通性','解释浏览器输入URL后的完整过程'],
    exercises:['计算子网划分','画出TCP三次握手过程'],
    resources:['计算机网络基础讲义','协议分析实验','网络拓扑图'],
    resourceLinks:[{title:'计算机导论MOOC课程',url:'https://kb.example.com/cs-003'}],
    difficulty:'重点', tags:['网络','TCP/IP','HTTP','DNS'] },
  { id:'cs-004', course:'计算机导论', title:'数据库原理入门',
    summary:'关系模型(表/行/列/主键/外键)、SQL基础查询(SELECT/WHERE/JOIN)、ER图设计',
    content:'【核心概念】关系模型(表/行/列/主键/外键)、SQL基础查询(SELECT/WHERE/JOIN)、ER图设计。详细讲义内容请参考课程教材与课堂笔记。',
    examples:['创建学生表并插入数据','查询成绩大于80分的学生'],
    exercises:['设计图书馆管理系统的ER图','写5条SQL查询语句'],
    resources:['数据库原理讲义','SQL练习题','ER图设计指南'],
    resourceLinks:[{title:'计算机导论MOOC课程',url:'https://kb.example.com/cs-004'}],
    difficulty:'基础', tags:['数据库','SQL','ER图'] },
  { id:'cs-005', course:'计算机导论', title:'计算机前沿技术概览',
    summary:'AI与机器学习概念、云计算(IaaS/PaaS/SaaS)、大数据技术、区块链原理、物联网架构',
    content:'【核心概念】AI与机器学习概念、云计算(IaaS/PaaS/SaaS)、大数据技术、区块链原理、物联网架构。详细讲义内容请参考课程教材与课堂笔记。',
    examples:['区分监督学习与无监督学习的应用场景','比较IaaS/PaaS/SaaS的典型产品'],
    exercises:['列举3个AI在日常生活中的应用','画出云计算服务模型图'],
    resources:['前沿技术综述','AI入门指南','云计算对比表'],
    resourceLinks:[{title:'计算机导论MOOC课程',url:'https://kb.example.com/cs-005'}],
    difficulty:'基础', tags:['人工智能','云计算','大数据','区块链'] },
  { id:'lab-001', course:'上机实验', title:'C语言编程环境搭建',
    summary:'开发环境安装(Dev-C++/VS Code/GCC)、创建第一个C程序、编译运行流程、基本调试方法',
    content:'【核心概念】开发环境安装(Dev-C++/VS Code/GCC)、创建第一个C程序、编译运行流程、基本调试方法。详细讲义内容请参考课程教材与课堂笔记。',
    examples:['在VS Code中配置C语言开发环境','编写并编译运行Hello World'],
    exercises:['独立完成开发环境配置','编写程序输出个人课表'],
    resources:['环境配置指南','VS Code配置教程','常见编译错误对照表'],
    resourceLinks:[{title:'上机实验MOOC课程',url:'https://kb.example.com/lab-001'}],
    difficulty:'基础', tags:['环境配置','编译','调试','VS Code'] },
  { id:'lab-002', course:'上机实验', title:'基本程序调试技巧',
    summary:'常见编译/链接/运行时错误排查、printf调试法、断点调试(设置/单步/监视)、单元测试概念',
    content:'【核心概念】常见编译/链接/运行时错误排查、printf调试法、断点调试(设置/单步/监视)、单元测试概念。详细讲义内容请参考课程教材与课堂笔记。',
    examples:['排查一个段错误(数组越界)','用断点调试找出循环逻辑错误'],
    exercises:['调试一个有3个bug的程序','使用断言(assert)验证程序正确性'],
    resources:['调试技巧手册','常见Bug案例集','单元测试指南'],
    resourceLinks:[{title:'上机实验MOOC课程',url:'https://kb.example.com/lab-002'}],
    difficulty:'重点', tags:['调试','断点','错误排查','测试'] },
  { id:'lab-003', course:'上机实验', title:'数组与字符串编程实验',
    summary:'数组遍历与操作、排序算法实现、字符串处理函数(strlen/strcpy/strcmp)、字符频率统计',
    content:'【核心概念】数组遍历与操作、排序算法实现、字符串处理函数(strlen/strcpy/strcmp)、字符频率统计。详细讲义内容请参考课程教材与课堂笔记。',
    examples:['实现数组元素查找（顺序查找）','字符串反转（不用strrev）'],
    exercises:['实现选择排序并输出每轮结果','判断一个字符串是否为回文'],
    resources:['实验指导书','数组操作模板','字符串函数参考'],
    resourceLinks:[{title:'上机实验MOOC课程',url:'https://kb.example.com/lab-003'}],
    difficulty:'重点', tags:['数组','字符串','排序','字符统计'] },
  { id:'lab-004', course:'上机实验', title:'函数与模块化编程实验',
    summary:'函数设计原则(单一职责)、多文件编程(.h/.c分离)、静态变量、程序模块化重构',
    content:'【核心概念】函数设计原则(单一职责)、多文件编程(.h/.c分离)、静态变量、程序模块化重构。详细讲义内容请参考课程教材与课堂笔记。',
    examples:['封装一个数学工具模块','使用头文件保护(#ifndef)'],
    exercises:['将之前程序拆分为多文件','编写一个学生成绩管理模块'],
    resources:['模块化编程指南','头文件模板','多文件编译教程'],
    resourceLinks:[{title:'上机实验MOOC课程',url:'https://kb.example.com/lab-004'}],
    difficulty:'重点', tags:['函数','模块化','头文件','多文件'] },
  { id:'lab-005', course:'上机实验', title:'综合项目实践',
    summary:'综合项目：学生成绩管理系统(增删改查+排序+文件存储+菜单交互)、项目开发流程与文档编写',
    content:'【核心概念】综合项目：学生成绩管理系统(增删改查+排序+文件存储+菜单交互)、项目开发流程与文档编写。详细讲义内容请参考课程教材与课堂笔记。',
    examples:['实现学生成绩管理系统的菜单框架','实现添加和显示功能'],
    exercises:['完成学生成绩管理系统的所有功能','为系统添加成绩统计功能'],
    resources:['项目需求文档','完整代码参考','项目答辩模板'],
    resourceLinks:[{title:'上机实验MOOC课程',url:'https://kb.example.com/lab-005'}],
    difficulty:'难点', tags:['综合项目','管理系统','文件存储'] }
];

var knowledgeKeywordMap = {};
(function buildKeywordMap() {
  for (var i = 0; i < knowledgeBase.length; i++) {
    var item = knowledgeBase[i];
    var words = item.title.split(/\s+/).concat(item.tags || []);
    words.push(item.course);
    if (item.summary) words = words.concat(item.summary.substring(0,60).split(/[\s,。；：、]+/));
    for (var w = 0; w < words.length; w++) {
      var kw = words[w].trim();
      if (kw.length < 2) continue;
      if (!knowledgeKeywordMap[kw]) knowledgeKeywordMap[kw] = [];
      if (knowledgeKeywordMap[kw].indexOf(item.id) === -1) knowledgeKeywordMap[kw].push(item.id);
    }
  }
})();

(function addRiskKeywords() {
  var riskMap = {
    '挂科': ['math-001','math-002','math-003','code-001','code-002','cs-001'],
    '不及格': ['math-001','math-002','code-001','cs-001'],
    '重修': ['math-003','code-003'],
    '出勤': ['lab-003','lab-004'],
    '作业': ['code-002','code-004','lab-003'],
    '基础薄弱': ['code-001','cs-001','lab-001'],
    '缺交': ['code-002','code-004'],
    '旷课': ['lab-003','lab-004'],
    '迟到': ['lab-003'],
    '偏科': ['math-001','eng-001','code-001'],
    '下滑': ['math-002','code-002'],
    '不理想': ['math-001','eng-001','code-001'],
    '质量差': ['code-002','code-004','lab-003'],
    '波动': ['math-002','code-005'],
    '全勤': ['lab-003','lab-004'],
    '良好': ['math-001','code-001','eng-001'],
    '优秀': ['math-002','code-005','eng-002'],
    '稳定': ['math-001','code-001','cs-001']
  };
  for (var kw in riskMap) {
    if (riskMap.hasOwnProperty(kw)) {
      if (!knowledgeKeywordMap[kw]) knowledgeKeywordMap[kw] = [];
      var ids = riskMap[kw];
      for (var i = 0; i < ids.length; i++) {
        if (knowledgeKeywordMap[kw].indexOf(ids[i]) === -1) knowledgeKeywordMap[kw].push(ids[i]);
      }
    }
  }
})();

function matchKnowledge(factors) {
  if (!factors || factors.length === 0) return [];
  var matchedIds = [], result = [];
  for (var i = 0; i < factors.length; i++) {
    for (var kw in knowledgeKeywordMap) {
      if (knowledgeKeywordMap.hasOwnProperty(kw) && factors[i].indexOf(kw) !== -1) {
        var ids = knowledgeKeywordMap[kw];
        for (var j = 0; j < ids.length; j++) {
          if (matchedIds.indexOf(ids[j]) === -1) {
            matchedIds.push(ids[j]);
            for (var k = 0; k < knowledgeBase.length; k++) {
              if (knowledgeBase[k].id === ids[j]) { result.push(knowledgeBase[k]); break; }
            }
          }
        }
      }
    }
  }
  return result;
}

function searchKnowledge(query) {
  if (!query || query.trim() === '') return knowledgeBase.slice();
  var q = query.toLowerCase().trim();
  return knowledgeBase.filter(function(item) {
    return item.title.toLowerCase().indexOf(q) !== -1 ||
           item.course.toLowerCase().indexOf(q) !== -1 ||
           item.summary.toLowerCase().indexOf(q) !== -1 ||
           (item.tags && item.tags.some(function(t) { return t.toLowerCase().indexOf(q) !== -1; }));
  });
}

function generateLearningPath(matchedItems) {
  if (!matchedItems || matchedItems.length === 0) return [];
  var weeks = [];
  var itemsPerWeek = Math.min(4, Math.max(2, Math.ceil(matchedItems.length / 3)));
  for (var i = 0; i < matchedItems.length; i += itemsPerWeek) {
    var weekItems = matchedItems.slice(i, i + itemsPerWeek);
    var weekNum = weeks.length + 1;
    weeks.push({
      week: weekNum,
      title: '第 ' + weekNum + ' 周',
      items: weekItems.map(function(it, idx) {
        return { day: idx + 1, item: it, task: '学习《' + it.title + '》', resource: (it.resources && it.resources[0]) || '讲义' };
      })
    });
  }
  return weeks;
}
