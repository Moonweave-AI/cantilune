\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{moonweave-report}[2026/07/28 v1.0 Moonweave technical report]

\newif\ifMWDraft
\MWDraftfalse
\DeclareOption{draft}{\MWDrafttrue}
\DeclareOption*{\PassOptionsToClass{\CurrentOption}{book}}
\ProcessOptions\relax
\LoadClass[11pt,oneside,openany]{book}

\RequirePackage{iftex}
\ifXeTeX\else
  \ClassError{moonweave-report}{XeLaTeX is required}
    {Select XeLaTeX as the compiler. The template uses OpenType fonts and CJK transitions.}
\fi

\RequirePackage{fontspec}
\RequirePackage[table]{xcolor}
\input{config/brand-colors}
\input{config/fonts}

\RequirePackage[a4paper,top=25mm,bottom=25mm,left=27mm,right=23mm,headheight=32pt,headsep=6mm,footskip=13mm]{geometry}
\RequirePackage{microtype}
\microtypesetup{protrusion=true,expansion=false}
\RequirePackage{setspace}
\RequirePackage{ragged2e}
\RequirePackage{enumitem}
\RequirePackage{graphicx}
\RequirePackage{booktabs}
\RequirePackage{longtable}
\RequirePackage{tabularx}
\RequirePackage{tabularray}
\UseTblrLibrary{booktabs}
\ExplSyntaxOn
\tl_set:Nn \tblrcontfootname {续下页}
\tl_set:Nn \tblrcontheadname {（续）}
\ExplSyntaxOff
\RequirePackage{array}
\RequirePackage{multirow}
\RequirePackage{amsmath}
\RequirePackage{amssymb}
\RequirePackage{mathtools}
\RequirePackage{stmaryrd}
\RequirePackage{tikz}
\usetikzlibrary{arrows.meta,backgrounds,calc,decorations.pathreplacing,fit,matrix,patterns,positioning,shapes.geometric}
\RequirePackage{pgfplots}
\RequirePackage{pgfplotstable}
\pgfplotsset{compat=1.18}
\usepgfplotslibrary{fillbetween,groupplots}
\RequirePackage{tcolorbox}
\tcbuselibrary{breakable,raster,skins}
\RequirePackage{listings}
\RequirePackage{float}
\RequirePackage{placeins}
\RequirePackage{caption}
\RequirePackage{subcaption}
\RequirePackage{titlesec}
\RequirePackage{fancyhdr}
\RequirePackage{lastpage}
\RequirePackage[bottom,hang]{footmisc}
\RequirePackage{csquotes}
\RequirePackage[round,authoryear]{natbib}
\RequirePackage{xurl}
\RequirePackage{hyperref}
\RequirePackage{bookmark}
\RequirePackage[capitalise,noabbrev]{cleveref}
\RequirePackage{xparse}
\RequirePackage{etoolbox}

\hypersetup{
  colorlinks=true,
  linkcolor=MWInk,
  citecolor=MWCyan,
  urlcolor=MWCyan,
  bookmarksnumbered=true,
  bookmarksopen=true,
  pdfdisplaydoctitle=true
}

\setstretch{1.075}
\setlength{\parindent}{0pt}
\setlength{\parskip}{0.62em plus 0.12em minus 0.08em}
\setlength{\emergencystretch}{2em}
\setcounter{secnumdepth}{3}
\setcounter{tocdepth}{2}
\setlist{nosep,leftmargin=1.7em,labelsep=0.65em}
\setlist[itemize,1]{label=\textcolor{MWCyan}{\small\(\bullet\)},topsep=0.35em,itemsep=0.25em}
\setlist[enumerate,1]{label=\textcolor{MWLilac}{\bfseries\arabic*.},topsep=0.35em,itemsep=0.25em}

\renewcommand{\arraystretch}{1.24}
\setlength{\tabcolsep}{7pt}
\newcolumntype{L}[1]{>{\RaggedRight\arraybackslash}p{#1}}
\newcolumntype{C}[1]{>{\Centering\arraybackslash}p{#1}}
\newcolumntype{R}[1]{>{\RaggedLeft\arraybackslash}p{#1}}
\newcolumntype{Y}{>{\RaggedRight\arraybackslash}X}

\captionsetup{
  font={small,sf},
  labelfont={bf,color=MWInk},
  textfont={color=MWMuted},
  format=plain,
  justification=RaggedRight,
  singlelinecheck=false,
  skip=7pt
}
\captionsetup[sub]{font={footnotesize,sf},labelfont={bf,color=MWInk}}
\renewcommand{\figurename}{Figure / 图}
\renewcommand{\tablename}{Table / 表}
\renewcommand{\contentsname}{Contents / 目录}
\renewcommand{\listfigurename}{Figures / 图目录}
\renewcommand{\listtablename}{Tables / 表目录}
\renewcommand{\bibname}{References / 参考文献}

\titleformat{\chapter}[display]
  {\normalfont}
  {\color{MWLilac}\MWMono\small\bfseries\MakeUppercase{\chaptername}\ \thechapter}
  {0.65em}
  {\color{MWInk}\fontsize{26}{30}\selectfont\MWDisplayText}
  [\vspace{0.6em}\color{MWLine}\titlerule]
\titlespacing*{\chapter}{0pt}{-7mm}{8mm}

\titleformat{\section}
  {\Large\bfseries\sffamily\color{MWInk}}
  {\color{MWCyan}\MWMono\thesection}
  {0.75em}{}
\titlespacing*{\section}{0pt}{1.7em}{0.55em}

\titleformat{\subsection}
  {\large\bfseries\sffamily\color{MWInk}}
  {\color{MWLilac}\MWMono\thesubsection}
  {0.75em}{}
\titlespacing*{\subsection}{0pt}{1.35em}{0.4em}

\titleformat{\subsubsection}
  {\normalsize\bfseries\sffamily\color{MWMuted}}
  {\MWMono\thesubsubsection}
  {0.7em}{}

\pagestyle{fancy}
\fancyhf{}
\fancyhead[L]{%
  \parbox[t]{0.39\textwidth}{\raggedright\footnotesize\color{MWMuted}\MWOrganization\ /\ \MWProjectName\strut}%
}
\fancyhead[R]{%
  \parbox[t]{0.56\textwidth}{\raggedleft\footnotesize\color{MWMuted}\nouppercase{\leftmark}\strut}%
}
\fancyfoot[L]{\footnotesize\MWMono\color{MWSoftText}\MWReportVersion}
\fancyfoot[R]{\footnotesize\MWMono\color{MWSoftText}\thepage\ /\ \pageref*{LastPage}}
\renewcommand{\headrulewidth}{0pt}
\renewcommand{\footrulewidth}{0pt}

\fancypagestyle{plain}{
  \fancyhf{}
  \fancyfoot[L]{\footnotesize\MWMono\color{MWSoftText}\MWReportVersion}
  \fancyfoot[R]{\footnotesize\MWMono\color{MWSoftText}\thepage\ /\ \pageref*{LastPage}}
  \renewcommand{\headrulewidth}{0pt}
}

\newcommand{\MWStatusBadge}[1]{%
  \tikz[baseline=(mwstatus.base)]\node[
    rounded corners=3pt,
    fill=MWLilac!12,
    draw=MWLilac!35,
    inner xsep=7pt,
    inner ysep=3pt,
    text=MWInk,
    font=\scriptsize\bfseries\sffamily
  ] (mwstatus) {#1};%
}

\newcommand{\MWChapter}[2]{%
  \chapter[#1 / #2]{%
    #1\\[-0.08em]%
    {\fontsize{20}{24}\selectfont #2}%
  }%
}

\newcommand{\MWKicker}[1]{%
  {\sffamily\scriptsize\bfseries\color{MWCyan}\MakeUppercase{#1}}\par
}

\newcommand{\MWSourceNote}[1]{%
  \par\vspace{0.25em}{\footnotesize\color{MWSoftText}\textbf{\MWLabelSource:} #1}\par
}

\newcommand{\MWTableHeader}[1]{\rowcolor{MWSoft!70}\textbf{#1}}
\newcommand{\MWBest}[1]{\textcolor{MWCyan}{\bfseries #1}}
\newcommand{\MWDelta}[1]{\textcolor{MWMint}{\bfseries #1}}

\newtcolorbox{MWAbstractBox}{
  enhanced,
  breakable,
  colback=MWMist,
  colframe=MWLine,
  boxrule=0.65pt,
  arc=3mm,
  boxsep=0.8mm,
  left=5mm,right=5mm,top=4.5mm,bottom=4.5mm
}

\newtcolorbox{MWCallout}[2][MWCyan]{
  enhanced,
  breakable,
  colback=#1!4!white,
  colframe=#1!52!MWLine,
  boxrule=0.65pt,
  arc=3mm,
  boxsep=0.7mm,
  left=4.5mm,right=4.5mm,top=3.5mm,bottom=3.5mm,
  title={#2},
  fonttitle=\bfseries\sffamily,
  coltitle=MWInk,
  colbacktitle=#1!7!white,
  titlerule=0pt,
  attach title to upper={\par\vspace{0.45em}}
}

\newenvironment{MWInsight}
  {\begin{MWCallout}[MWCyan]{\MWLabelInsight}}
  {\end{MWCallout}}
\newenvironment{MWDecision}
  {\begin{MWCallout}[MWLilac]{\MWLabelDecision}}
  {\end{MWCallout}}
\newenvironment{MWRisk}
  {\begin{MWCallout}[MWBlush]{\MWLabelRisk}}
  {\end{MWCallout}}

\newenvironment{MWMetricGrid}
  {\begin{tcbraster}[raster columns=3,raster equal height,raster column skip=3mm,raster row skip=3mm]}
  {\end{tcbraster}}

\newcommand{\MWMetricCard}[4][MWCyan]{%
  \begin{tcolorbox}[
    enhanced,
    colback=MWMist,
    colframe=#1!52!MWLine,
    boxrule=0.65pt,
    arc=3mm,
    boxsep=0.7mm,
    left=4mm,right=4mm,top=3.5mm,bottom=3.5mm
  ]
    \raggedright
    {\fontsize{22}{25}\selectfont\bfseries\color{MWInk}#2}\par
    \vspace{0.25em}{\small\bfseries\color{MWMuted}#3}\par
    \vspace{0.35em}{\scriptsize\color{MWSoftText}#4}
  \end{tcolorbox}%
}

\newtcolorbox{MWCodeBox}[1][Reproduction snippet]{
  enhanced,
  breakable,
  colback=MWNight,
  colframe=MWNightSoft,
  boxrule=0.65pt,
  arc=3mm,
  boxsep=0.7mm,
  title={#1},
  coltitle=MWMoonMilk,
  fonttitle=\small\bfseries\sffamily,
  left=4mm,right=4mm,top=3mm,bottom=3mm
}

\lstdefinestyle{moonweave}{
  basicstyle=\MWMono\footnotesize\color{MWMoonMilk},
  keywordstyle=\bfseries\color{MWBrightCyan},
  commentstyle=\itshape\color{MWDarkMuted},
  stringstyle=\color{MWBrightMint},
  numberstyle=\tiny\color{MWDarkMuted},
  numbers=left,
  numbersep=8pt,
  showstringspaces=false,
  breaklines=true,
  columns=fullflexible,
  keepspaces=true,
  frame=none,
  tabsize=2
}

\crefname{figure}{figure}{figures}
\crefname{table}{table}{tables}
\crefname{section}{section}{sections}
\crefname{chapter}{chapter}{chapters}
\crefname{equation}{equation}{equations}

\AtBeginDocument{%
  \color{MWInk}%
  \hypersetup{
    pdftitle={\MWReportTitleEN},
    pdfauthor={\MWAuthors},
    pdfsubject={\MWReportType},
    pdfkeywords={\MWKeywords}
  }%
  \ifMWDraft
    \fancyhead[C]{\MWStatusBadge{DRAFT}}
  \fi
}
