document.addEventListener("DOMContentLoaded", () => {
  // 전역 변수 선언
  let stage;
  let layer;
  let isPHMeterActive = false;
  let currentSpeed = 1; // 현재 속도 배율 (기본값: 1)
  let baseInterval = 400; // 기본 인터벌 시간 (ms)

  // DOM 요소 초기화
  const gameArea = document.getElementById("gameArea");
  const mainScreen = document.getElementById("mainScreen");
  const gameScreen = document.getElementById("gameScreen");
  const startBtn = document.getElementById("startBtn");
  const experimentArea = document.getElementById("experimentArea");
  const toolsButton = document.getElementById("toolsButton");
  const toolsModal = document.getElementById("toolsModal");
  const closeButton = document.querySelector(".close");
  const phPanel = document.getElementById("phPanel");
  const phValue = document.getElementById("phValue");
  const closePhPanel = document.getElementById("closePhPanel");
  const panelHeader = phPanel.querySelector(".panel-header");

  // pH 패널 드래그 기능
  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  let xOffset = 0;
  let yOffset = 0;

  // 드래그 시작
  panelHeader.addEventListener("mousedown", (e) => {
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;

    if (e.target === panelHeader || e.target.parentNode === panelHeader) {
      isDragging = true;
      panelHeader.style.cursor = "grabbing";
    }
  });

  // 드래그 중
  document.addEventListener("mousemove", (e) => {
    if (isDragging) {
      e.preventDefault();

      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;

      xOffset = currentX;
      yOffset = currentY;

      setTranslate(currentX, currentY, phPanel);
    }
  });

  // 드래그 끝
  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      panelHeader.style.cursor = "grab";
    }
  });

  // 요소 위치 설정
  function setTranslate(xPos, yPos, el) {
    el.style.transform = `translate(${xPos}px, ${yPos}px)`;
  }

  // Konva 스테이지 초기화
  function initStage() {
    stage = new Konva.Stage({
      container: "experimentArea",
      width: experimentArea.offsetWidth,
      height: experimentArea.offsetHeight,
    });
    stage.draggable(true);

    layer = new Konva.Layer();
    stage.add(layer);

    const initialScale = 1.5;
    stage.scale({ x: initialScale, y: initialScale });

    // 스테이지 중앙 정렬
    const centerX = stage.width() / 2;
    const centerY = stage.height() / 2;

    const newPos = {
      x: centerX - centerX * initialScale,
      y: centerY - centerY * initialScale,
    };

    stage.position(newPos);
    stage.batchDraw();

    // 초기 실험 도구 설정
    // 250mL 비커 생성
    const beaker = createTool("volumetric-flask", centerX - 100, centerY);
    const burette = createTool("burette", centerX + 100, centerY);

    console.log(beaker);
    console.log(burette);
    // 용액 자동 추가
    setTimeout(() => {
      // beaker.container.addSolution("phenolphthalein", 1);
      beaker.container.addSolution("naoh", 10);
      burette.container.addSolution("hcl", 10);
    }, 100);
  }

  // 시작 버튼 클릭 이벤트
  startBtn.addEventListener("click", () => {
    mainScreen.style.display = "none";
    gameScreen.style.display = "block";

    initStage();
    initSimulation();
  });

  // Matter.js 엔진 초기화
  const engine = Matter.Engine.create();
  const world = engine.world;
  const render = Matter.Render.create({
    element: experimentArea,
    engine: engine,
    options: {
      width: experimentArea.offsetWidth,
      height: experimentArea.offsetHeight,
      wireframes: false,
      background: "transparent",
      transparent: true,
    },
  });

  // 바닥 경계 생성
  const ground = Matter.Bodies.rectangle(
    experimentArea.offsetWidth / 2,
    experimentArea.offsetHeight - 10,
    experimentArea.offsetWidth,
    20,
    { isStatic: true }
  );

  Matter.World.add(world, ground);

  // 모드 버튼 이벤트 처리
  document.querySelectorAll(".mode-button").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.mode;

      // 모든 모드 버튼 비활성화
      document.querySelectorAll(".mode-button").forEach((btn) => {
        btn.classList.remove("active");
      });

      // 클릭된 버튼 활성화
      button.classList.add("active");
    });
  });

  // 액션 버튼 이벤트 처리
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;

      switch (action) {
        case "speed":
          toggleReactionSpeed();
          break;
        case "undo":
          undoLastAction();
          break;
        case "zoom":
          toggleZoomMode();
          break;
        case "graph":
          toggleDataGraph();
          break;
      }
    });
  });

  // 도구 버튼 클릭 시 모달 열기
  toolsButton.addEventListener("click", () => {
    toolsModal.style.display = "block";
  });

  // 닫기 버튼 클릭 시 모달 닫기
  closeButton.addEventListener("click", () => {
    toolsModal.style.display = "none";
  });

  // 모달 외부 클릭 시 닫기
  window.addEventListener("click", (event) => {
    if (event.target === toolsModal) {
      toolsModal.style.display = "none";
    }
  });

  // 용액 관련 상수
  const SOLUTIONS = {
    naoh: {
      name: "NaOH",
      concentration: 0.1, // 0.1M
      color: "rgba(220, 230, 240, 0.85)", // 살짝 푸른 빛이 도는 무색
      type: "base",
      mw: 40, // g/mol (NaOH의 분자량)
    },
    hcl: {
      name: "HCl",
      concentration: 0.1,
      color: "rgba(240, 235, 220, 0.85)", // 살짝 노란 빛이 도는 무색
      type: "acid",
      mw: 36.46, // g/mol (HCl의 분자량)
    },
    nacl: {
      name: "NaCl",
      color: "rgba(255, 255, 255, 0.85)", // 무색
      type: "salt",
      mw: 58.44, // g/mol (NaCl의 분자량)
    },
    phenolphthalein: {
      name: "phenolphthalein",
      color: "rgba(230, 230, 230, 0.85)", // 거의 불투명한 무색
      type: "indicator",
    },
    distilled_water: {
      name: "distilled water",
      color: "rgba(230, 240, 245, 0.85)", // 살짝 푸른 빛이 도는 무색
      type: "neutral",
      concentration: 0,
    },
  };

  // 현재 선택된 시약 정보를 저장할 변수
  let selectedSolution = null;

  // 용액을 담을 수 있는 컨테이너 클래스
  class Container {
    constructor(type, capacity) {
      this.type = type;
      this.capacity = capacity; // mL 단위
      this.contents = []; // 담긴 용액들 배열
      this.currentVolume = 0;
      this.isPouring = false;
      this.color = "rgba(255, 255, 255, 0.2)";
      this.hasIndicator = false;
      this.currentMolarity = 0; // 현재 용액의 몰농도
    }

    // 몰농도 계산
    calculateMolarity() {
      if (this.currentVolume === 0) return 0;

      // 산성 용액과 염기성 용액의 총 몰 수 계산
      let totalMoles = 0;
      let acidMoles = 0;
      let baseMoles = 0;

      this.contents.forEach((solution) => {
        if (SOLUTIONS[solution.type].type === "acid") {
          acidMoles +=
            (solution.volume / 1000) * SOLUTIONS[solution.type].concentration;
        } else if (SOLUTIONS[solution.type].type === "base") {
          baseMoles +=
            (solution.volume / 1000) * SOLUTIONS[solution.type].concentration;
        }
      });

      // 산-염기 중화 반응 고려
      totalMoles = Math.abs(acidMoles - baseMoles);

      // 몰농도 = 몰수 / 부피(L)
      this.currentMolarity = totalMoles / (this.currentVolume / 1000);
      return this.currentMolarity;
    }

    // 용액 정보 텍스트 생성
    getContentsInfo() {
      if (this.contents.length === 0) {
        return "0mL";
      }

      // 모든 용액의 총 부피 계산
      const totalVolume = this.contents.reduce(
        (sum, solution) => sum + solution.volume,
        0
      );
      return `${totalVolume.toFixed(1)}mL`;
    }

    // 용액 추가
    addSolution(solution, volume) {
      if (solution === "phenolphthalein") {
        this.hasIndicator = true;
        this.updateColor();
        return true;
      }

      const roundedVolume = Math.round(volume * 10) / 10; // 소수점 첫째자리까지만 사용

      // 뷰렛인 경우 콕이 열려있으면 용액 추가 불가
      if (this.type === "burette") {
        let buretteShape = null;
        layer.children.forEach((shape) => {
          if (shape.container === this) {
            buretteShape = shape;
          }
        });

        if (buretteShape) {
          const stopcock = buretteShape.findOne(".stopcock");
          if (stopcock && stopcock.isOpen) {
            console.log("콕이 열려있어 용액을 추가할 수 없습니다.");
            return false;
          }
        }
      }

      if (this.currentVolume + roundedVolume > this.capacity) {
        console.log("용량 초과");
        return false;
      }

      // 기존 용액과의 반응 확인
      if (this.contents.length > 0) {
        const existingSolution = this.contents[this.contents.length - 1];

        // NaOH + HCl -> NaCl + H2O 반응 처리
        if (
          (solution === "naoh" && existingSolution.type === "hcl") ||
          (solution === "hcl" && existingSolution.type === "naoh")
        ) {
          // 반응물의 몰 수 계산
          const existingMoles =
            (existingSolution.volume / 1000) *
            SOLUTIONS[existingSolution.type].concentration;
          const newMoles =
            (roundedVolume / 1000) * SOLUTIONS[solution].concentration;

          // 반응 후 남은 용액 계산
          if (existingMoles > newMoles) {
            // 기존 용액이 더 많은 경우
            const remainingMoles = existingMoles - newMoles;
            this.contents = [
              {
                type: existingSolution.type,
                volume:
                  (remainingMoles * 1000) /
                  SOLUTIONS[existingSolution.type].concentration,
              },
              {
                type: "nacl",
                volume: roundedVolume,
              },
            ];
          } else if (existingMoles < newMoles) {
            // 새 용액이 더 많은 경우
            const remainingMoles = newMoles - existingMoles;
            this.contents = [
              {
                type: solution,
                volume:
                  (remainingMoles * 1000) / SOLUTIONS[solution].concentration,
              },
              {
                type: "nacl",
                volume: existingSolution.volume,
              },
            ];
          } else {
            // 완전히 반응하는 경우
            this.contents = [
              {
                type: "nacl",
                volume: roundedVolume,
              },
            ];
          }
        } else {
          // 반응하지 않는 경우 그대로 추가
          this.contents.push({
            type: solution,
            volume: roundedVolume,
          });
        }
      } else {
        // 첫 용액 추가
        this.contents.push({
          type: solution,
          volume: roundedVolume,
        });
      }

      this.currentVolume =
        Math.round((this.currentVolume + roundedVolume) * 10) / 10;
      this.calculateMolarity();
      this.updateColor();

      // 용액 추가 후 시각적 업데이트
      layer.children.forEach((shape) => {
        if (shape.container === this) {
          const liquid = shape.findOne(".liquid");
          if (liquid) {
            if (this.type === "burette") {
              const maxHeight = 180;
              const heightRatio = this.currentVolume / this.capacity;
              const newHeight = maxHeight * heightRatio;
              liquid.data(
                `M15,${180 - newHeight} L25,${
                  180 - newHeight
                } L25,180 C25,185 20,185 20,185 C20,185 15,185 15,180 Z`
              );
            } else {
              const fillHeight =
                (this.currentVolume / this.capacity) * liquid.usableHeight;
              liquid.height(fillHeight);
              liquid.y(liquid.liquidStartY - fillHeight);
            }
            liquid.fill(this.color);
          }

          const infoText = shape.findOne(".infoText");
          if (infoText) {
            infoText.text(this.getContentsInfo());
          }
        }
      });
      layer.batchDraw();

      return true;
    }

    // 용액 색상 업데이트 (혼합)
    updateColor() {
      if (this.contents.length === 0 && !this.hasIndicator) {
        this.color = "rgba(255, 255, 255, 0.2)"; // 빈 용기
        return;
      }

      // 기본 용액 색상 설정 (마지막으로 추가된 용액의 색상 사용)
      if (this.contents.length > 0) {
        const lastSolution = this.contents[this.contents.length - 1];
        this.color = SOLUTIONS[lastSolution.type].color;
      } else {
        this.color = "rgba(230, 230, 230, 0.85)"; // 기본 무색
      }

      // 페놀프탈레인이 있을 때 색상 변화
      if (this.hasIndicator) {
        let baseVolume = this.contents
          .filter((c) => SOLUTIONS[c.type].type === "base")
          .reduce((sum, c) => sum + c.volume, 0);

        let isBasic = baseVolume > 0;

        if (isBasic) {
          this.color = "rgba(255, 105, 180, 0.9)"; // 더 선명한 분홍색
        }
      }
    }

    // 용액 따르기 시작
    startPouring(targetContainer) {
      if (this.currentVolume <= 0 || this.isPouring) return false;

      this.isPouring = true;
      this.pouringTarget = targetContainer;
      this.pouringInterval = setInterval(() => {
        const pourAmount = 1; // 0.1mL씩 이동

        // 현재 용량이 pourAmount보다 작으면 남은 용량 전부 이동
        const actualPourAmount = Math.min(
          pourAmount,
          Math.round(this.currentVolume * 10) / 10
        );

        if (
          this.currentVolume > 0 &&
          targetContainer.currentVolume + actualPourAmount <=
            targetContainer.capacity
        ) {
          // 현재 용액의 정보 저장
          const currentSolution = this.contents[this.contents.length - 1];

          // 용액 이동
          this.removeSolution(actualPourAmount);

          // 반응 검사 및 처리
          const isAcidBase = (type1, type2) => {
            return (
              (type1 === "naoh" && type2 === "hcl") ||
              (type1 === "hcl" && type2 === "naoh")
            );
          };

          const getMoles = (volume, type) => {
            return (volume / 1000) * SOLUTIONS[type].concentration;
          };

          // 현재 부어지는 용액의 몰 수
          const pouringMoles = getMoles(actualPourAmount, currentSolution.type);

          // 대상 용기의 모든 용액 처리
          let remainingPourMoles = pouringMoles;
          let newContents = [...targetContainer.contents];
          let reactionOccurred = false;

          // 산-염기 반응이 가능한 용액 찾기
          for (let i = 0; i < newContents.length; i++) {
            const targetSol = newContents[i];
            if (isAcidBase(currentSolution.type, targetSol.type)) {
              const targetMoles = getMoles(targetSol.volume, targetSol.type);

              if (targetMoles > remainingPourMoles) {
                // 기존 용액이 더 많은 경우
                const remainingTargetMoles = targetMoles - remainingPourMoles;
                newContents[i] = {
                  type: targetSol.type,
                  volume:
                    (remainingTargetMoles * 1000) /
                    SOLUTIONS[targetSol.type].concentration,
                };
                // NaCl 추가
                newContents.push({
                  type: "nacl",
                  volume: actualPourAmount,
                });
                remainingPourMoles = 0;
              } else {
                // 부어지는 용액이 더 많거나 같은 경우
                remainingPourMoles -= targetMoles;
                // 이 용액은 완전히 반응
                newContents[i] = {
                  type: "nacl",
                  volume: targetSol.volume,
                };
              }
              reactionOccurred = true;
              break;
            }
          }

          // 반응하지 않고 남은 용액 처리
          if (remainingPourMoles > 0) {
            newContents.push({
              type: currentSolution.type,
              volume:
                (remainingPourMoles * 1000) /
                SOLUTIONS[currentSolution.type].concentration,
            });
          }

          // 결과 적용
          targetContainer.contents = newContents;
          targetContainer.currentVolume =
            Math.round(
              (targetContainer.currentVolume + actualPourAmount) * 10
            ) / 10;
          targetContainer.calculateMolarity();
          targetContainer.updateColor();

          // 시각적 업데이트 - 뷰렛
          layer.children.forEach((shape) => {
            if (shape.container === this) {
              const liquid = shape.findOne(".liquid");
              if (liquid) {
                const maxHeight = 180;
                const heightRatio = this.currentVolume / this.capacity;
                const newHeight = maxHeight * heightRatio;
                liquid.data(
                  `M15,${180 - newHeight} L25,${
                    180 - newHeight
                  } L25,180 C25,185 20,185 20,185 C20,185 15,185 15,180 Z`
                );
                liquid.fill(this.color);
              }

              const infoText = shape.findOne(".infoText");
              if (infoText) {
                infoText.text(this.getContentsInfo());
              }
            }
            // 비커 업데이트
            else if (shape.container === targetContainer) {
              const liquid = shape.findOne(".liquid");
              if (liquid) {
                const fillHeight =
                  (targetContainer.currentVolume / targetContainer.capacity) *
                  liquid.usableHeight;
                liquid.height(fillHeight);
                liquid.y(liquid.liquidStartY - fillHeight);
                liquid.fill(targetContainer.color);

                const infoText = shape.findOne(".infoText");
                if (infoText) {
                  infoText.text(targetContainer.getContentsInfo());
                }
              }
            }
          });

          layer.batchDraw();
        } else {
          this.stopPouring();
        }
      }, baseInterval / currentSpeed);

      return true;
    }

    // 용액 따르기 중지
    stopPouring() {
      if (!this.isPouring) return;

      clearInterval(this.pouringInterval);
      this.isPouring = false;
      this.pouringTarget = null;

      // 용액 정보 업데이트
      if (this.contents.length > 0) {
        this.calculateMolarity();
      }
      this.updateColor();
    }

    // 용액 제거
    removeSolution(volume) {
      if (volume > this.currentVolume) return false;

      let remainingToRemove = Math.round(volume * 10) / 10; // 소수점 첫째자리까지만 사용
      while (remainingToRemove > 0 && this.contents.length > 0) {
        const lastSolution = this.contents[this.contents.length - 1];
        if (lastSolution.volume <= remainingToRemove) {
          remainingToRemove =
            Math.round((remainingToRemove - lastSolution.volume) * 10) / 10;
          this.currentVolume =
            Math.round((this.currentVolume - lastSolution.volume) * 10) / 10;
          this.contents.pop();
        } else {
          lastSolution.volume =
            Math.round((lastSolution.volume - remainingToRemove) * 10) / 10;
          this.currentVolume =
            Math.round((this.currentVolume - remainingToRemove) * 10) / 10;
          remainingToRemove = 0;
        }
      }

      this.updateColor();
      return true;
    }
  }

  // 스냅 관련 상수 추가
  const SNAP_DISTANCE = 50; // 스냅이 작동하는 거리 (픽셀)
  const BEAKER_TYPES = ["beaker", "beaker-250", "flask", "volumetric-flask"];

  function getDistance(p1, p2) {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }

  // 도구 생성 함수
  function createTool(type, x, y) {
    console.log("Creating tool:", type, "at", x, y);
    let shape;
    let container;

    const createLiquidContainer = (width, height, capacity) => {
      container = new Container(type, capacity);

      const group = new Konva.Group({
        x: x,
        y: y,
        draggable: true,
        name: "tool",
        offset: {
          x: 0, // 좌측을 기준으로
          y: -height, // 하단을 기준으로
        },
      });

      // 용기의 실제 사용 가능한 영역 정의
      const topMargin = 10; // 상단 여백
      const bottomMargin = 5; // 하단 여백
      const usableHeight = height - topMargin - bottomMargin;
      const liquidStartY = height - bottomMargin; // 액체가 시작되는 Y 좌표

      // 용기 본체
      const body = new Konva.Path({
        data: `M10,5 L${width - 10},5 C${width - 5},5 ${width - 5},10 ${
          width - 5
        },10 
              L${width - 5},${height - 5} C${width - 5},${height} ${
          width - 10
        },${height} ${width - 10},${height} 
              L10,${height} C5,${height} 5,${height - 5} 5,${height - 5} 
              L5,10 C5,5 10,5 10,5 Z`,
        fill: "rgba(240,240,255,0.7)",
        stroke: "#000000",
        strokeWidth: 1,
      });

      // 눈금선들
      for (let i = 0; i <= 5; i++) {
        // 0부터 시작하여 바닥부터 눈금 표시
        const ratio = i / 5;
        const markHeight = liquidStartY - ratio * usableHeight;
        const mark = new Konva.Line({
          points: [10, markHeight, 20, markHeight],
          stroke: "#000000",
          strokeWidth: 0.5,
        });
        group.add(mark);

        // 눈금 숫자 표시
        const volumeAtMark = Math.round(ratio * capacity);
        const volumeText = new Konva.Text({
          x: 22,
          y: markHeight - 5,
          text: `${volumeAtMark}mL`,
          fontSize: 8,
          fill: "#666666",
        });
        group.add(volumeText);
      }

      // 용액 정보 표시를 위한 텍스트
      const infoText = new Konva.Text({
        x: width / 2 - 35,
        y: height + 5,
        text: "",
        fontSize: 10,
        fill: "#333333",
        align: "center",
        name: "infoText",
        width: 70,
      });

      // 액체
      const liquid = new Konva.Rect({
        x: 7,
        y: liquidStartY, // 바닥에서 시작
        width: width - 14,
        height: 0,
        fill: container.color,
        name: "liquid",
      });

      // 디버깅용 정보 저장
      liquid.usableHeight = usableHeight;
      liquid.liquidStartY = liquidStartY;

      // 모든 요소를 추가한 후 실제 크기 계산하여 offset 설정
      group.add(body);
      group.add(liquid);
      group.add(infoText);
      group.container = container;

      // 실제 크기 계산
      const bbox = group.getClientRect();
      group.offset({
        x: bbox.width / 2,
        y: bbox.height / 2,
      });

      return group;
    };

    switch (type) {
      case "beaker":
        shape = createLiquidContainer(60, 80, 100);
        break;

      case "beaker-250":
        shape = createLiquidContainer(80, 100, 250);
        break;

      case "flask":
        shape = createLiquidContainer(70, 90, 250);
        break;

      case "volumetric-flask":
        shape = createLiquidContainer(60, 100, 100);
        break;

      case "ph-meter":
        shape = new Konva.Group({
          x: x,
          y: y,
          draggable: true,
          name: "tool",
        });

        // pH 미터 본체
        const phMeterBody = new Konva.Path({
          data: "M15,0 L35,0 C40,0 40,5 40,5 L40,70 C40,75 35,75 35,75 L15,75 C10,75 10,70 10,70 L10,5 C10,0 15,0 15,0 Z",
          fill: "#e0e0e0",
          stroke: "#000000",
          strokeWidth: 1,
        });

        // 디스플레이 화면
        const display = new Konva.Rect({
          x: 15,
          y: 10,
          width: 20,
          height: 25,
          fill: "#222222",
          stroke: "#444444",
          strokeWidth: 1,
          cornerRadius: 2,
        });

        // 전극부
        const electrode = new Konva.Path({
          data: "M22,75 L22,120 C22,123 25,125 25,125 C25,125 28,123 28,120 L28,75",
          fill: "#silver",
          stroke: "#000000",
          strokeWidth: 1,
        });

        shape.add(phMeterBody);
        shape.add(display);
        shape.add(electrode);

        // 실제 크기 계산
        const phBbox = shape.getClientRect();
        shape.offset({
          x: phBbox.width / 2,
          y: phBbox.height / 2,
        });
        break;

      case "burette":
        const offsetY = -200;
        shape = new Konva.Group({
          x: x,
          y: y,
          draggable: true,
          name: "tool",
        });

        // 뷰렛 컨테이너 초기화
        container = new Container("burette", 50); // 50ml 용량
        shape.container = container;

        // 스탠드 받침대 (밑판)
        const baseStand = new Konva.Rect({
          x: -10,
          y: 365 + offsetY,
          width: 60,
          height: 10,
          fill: "#666666",
          stroke: "#000000",
          strokeWidth: 1,
          cornerRadius: 2,
        });

        // 스탠드 기둥
        const standPole = new Konva.Rect({
          x: 35,
          y: 160 + offsetY,
          width: 8,
          height: 215,
          fill: "#666666",
          stroke: "#000000",
          strokeWidth: 1,
        });

        // 뷰렛 본체 배경 (투명한 유리 효과)
        const buretteBackground = new Konva.Path({
          y: -150,
          data: "M15,0 L25,0 L25,180 C25,185 20,185 20,185 C20,185 15,185 15,180 Z",
          fill: "rgba(240,240,255,0.7)",
          stroke: "#000000",
          strokeWidth: 1,
        });

        // 용액을 표시할 영역
        const liquid = new Konva.Path({
          y: -150,
          data: "M15,180 L25,180 L25,180 C25,185 20,185 20,185 C20,185 15,185 15,180 Z",
          fill: container.color,
          name: "liquid",
        });
        liquid.liquidStartY = 30;
        liquid.usableHeight = 180;

        // 눈금 표시 (50mL 기준)
        for (let i = 0; i <= 50; i += 5) {
          // 긴 눈금
          const mark = new Konva.Line({
            points: [10, -150 + i * 3.6, 14, -150 + i * 3.6],
            stroke: "#000000",
            strokeWidth: 1,
          });
          shape.add(mark);

          // 눈금 숫자
          const text = new Konva.Text({
            x: 0,
            y: -153 + i * 3.6,
            text: (50 - i).toString(),
            fontSize: 10,
            fill: "#000000",
          });
          shape.add(text);
        }

        // 중간 눈금
        for (let i = 0; i <= 50; i++) {
          if (i % 5 !== 0) {
            const mark = new Konva.Line({
              points: [12, -150 + i * 3.6, 14, -150 + i * 3.6],
              stroke: "#000000",
              strokeWidth: 0.5,
            });
            shape.add(mark);
          }
        }

        // 용액 정보 표시
        const infoText = new Konva.Text({
          x: 20,
          y: -80,
          text: "",
          fontSize: 10,
          fill: "#333333",
          align: "center",
          name: "infoText",
          width: 70,
        });

        // 용액 높이 업데이트 함수
        const updateLiquidHeight = () => {
          if (!container) return;

          const maxHeight = 180; // 뷰렛의 전체 높이
          const heightRatio = container.currentVolume / container.capacity;
          const newHeight = maxHeight * heightRatio;

          liquid.data(
            `M15,${180 - newHeight} L25,${
              180 - newHeight
            } L25,180 C25,185 20,185 20,185 C20,185 15,185 15,180 Z`
          );
          liquid.fill(container.color);

          // 용액 정보 업데이트
          if (infoText) {
            infoText.text(container.getContentsInfo());
          }

          layer.batchDraw();
        };

        // Container 클래스의 메서드 오버라이드
        container.updateColor = function () {
          // 기존 updateColor 로직 실행
          Container.prototype.updateColor.call(this);
          // 용액 표시 업데이트
          updateLiquidHeight();
        };

        // 콕(코크) 위치 조정
        const stopcock = new Konva.Group({
          x: 20,
          y: 15,
          name: "stopcock",
          rotation: 90, // 처음에는 90도(닫힌 상태)로 시작
        });

        // 콕 본체
        const stopcockBody = new Konva.Path({
          data: "M-5,-5 L5,-5 L5,5 L-5,5 Z",
          fill: "#444444",
          stroke: "#000000",
          strokeWidth: 1,
        });

        // 콕 핸들
        const stopcockHandle = new Konva.Path({
          data: "M-8,-2 L-15,0 L-8,2 Z",
          fill: "#444444",
          stroke: "#000000",
          strokeWidth: 1,
        });

        stopcock.add(stopcockBody);
        stopcock.add(stopcockHandle);

        // 콕 회전 상태 초기화
        stopcock.isOpen = false;

        // 콕 클릭 이벤트 수정
        stopcock.on("mousedown touchstart", function (e) {
          // 스냅된 비커 찾기
          const snappedBeaker = layer.children.find(
            (child) =>
              child !== shape &&
              child.container &&
              BEAKER_TYPES.includes(child.container.type) &&
              child.snapTarget === shape
          );

          if (snappedBeaker && shape.container) {
            // 콕 회전 애니메이션
            const openTween = new Konva.Tween({
              node: this,
              rotation: 180,
              duration: 0.1,
              onFinish: () => {
                shape.container.startPouring(snappedBeaker.container);
              },
            });
            openTween.play();
          }
        });

        // 마우스를 뗄 때 콕 닫기
        const closeStopcock = function () {
          const closeTween = new Konva.Tween({
            node: this,
            rotation: 90,
            duration: 0.1,
            onFinish: () => {
              if (shape.container) {
                shape.container.stopPouring();
              }
            },
          });
          closeTween.play();
        };

        stopcock.on("mouseup touchend", closeStopcock);
        stopcock.on("mouseout", closeStopcock);

        // 모든 요소 추가
        shape.add(standPole);
        shape.add(baseStand);
        shape.add(buretteBackground);
        shape.add(liquid);
        shape.add(stopcock);
        shape.add(infoText);

        // 초기 용액 상태 표시
        updateLiquidHeight();

        break;
    }

    if (shape) {
      if (container) {
        shape.container = container;
      }

      // 드래그 이벤트
      shape.on("dragstart", () => {
        console.log("Drag start, tool type:", shape.container?.type);

        // 뷰렛인 경우 스냅된 비커 찾기
        if (shape.container && shape.container.type === "burette") {
          shape.snappedBeaker = layer.children.find(
            (child) =>
              child !== shape &&
              child.container &&
              BEAKER_TYPES.includes(child.container.type) &&
              child.snapTarget === shape
          );
        }
      });

      shape.on("dragmove", (e) => {
        const pos = stage.getPointerPosition();

        // 뷰렛이 이동할 때 스냅된 비커도 같이 이동
        if (
          shape.container &&
          shape.container.type === "burette" &&
          shape.snappedBeaker
        ) {
          const burettePos = shape.absolutePosition();
          const standPos = {
            x: burettePos.x - 10,
            y: burettePos.y + 230,
          };

          // 비커의 스냅 위치 계산
          const snapPosition = {
            x: standPos.x + 30 - shape.snappedBeaker.width(), // 받침대 중앙에서 비커 너비만큼 왼쪽으로
            y: standPos.y - 50, // 받침대 위에 위치
          };

          // 비커 위치 업데이트
          shape.snappedBeaker.absolutePosition(snapPosition);
        }

        // 비커류를 드래그하는 경우의 기존 로직
        if (shape.container && BEAKER_TYPES.includes(shape.container.type)) {
          console.log("Dragging beaker"); // 디버깅

          // 모든 뷰렛 찾기
          layer.children.forEach((other) => {
            // 디버깅을 위한 로그 추가
            console.log(
              "Checking shape:",
              other.name(),
              "Container type:",
              other.container?.type
            );

            if (
              other !== shape &&
              other.container &&
              other.container.type === "burette"
            ) {
              console.log("Found burette"); // 디버깅

              // 이미 스냅된 비커가 있는지 확인
              const hasSnappedBeaker = layer.children.some(
                (child) =>
                  child !== shape &&
                  child.container &&
                  BEAKER_TYPES.includes(child.container.type) &&
                  child.snapTarget === other
              );

              if (hasSnappedBeaker) {
                console.log("Another beaker is already snapped"); // 디버깅
                return;
              }

              // 뷰렛의 받침대 위치 계산
              const burettePos = other.absolutePosition();
              console.log("Burette position:", burettePos); // 디버깅

              const standPos = {
                x: burettePos.x - 10, // 받침대 왼쪽 끝
                y: burettePos.y + 230, // 받침대 높이
              };
              console.log("Stand position:", standPos); // 디버깅

              // 현재 비커의 위치와 크기
              const beakerPos = shape.absolutePosition();
              const beakerHeight = shape.height();
              console.log(
                "Beaker position:",
                beakerPos,
                "Beaker height:",
                beakerHeight
              ); // 디버깅

              // 비커와 받침대 사이의 거리 계산 (비커 우측 하단 기준)
              const distance = Math.sqrt(
                Math.pow(beakerPos.x - (standPos.x + 30), 2) + // 받침대 중앙으로 30px 이동
                  Math.pow(beakerPos.y - standPos.y, 2)
              );

              console.log("Distance to burette stand:", distance); // 디버깅

              // 스냅 거리 내에 있으면 자동으로 붙이기
              if (distance < 100) {
                // 스냅 거리를 100px로 유지
                console.log("Snapping beaker to burette stand"); // 디버깅

                // 비커를 받침대에 위치시키기 (비커 우측 하단이 받침대에 닿도록)
                const snapPosition = {
                  x: standPos.x + 30 - shape.width(), // 받침대 중앙에서 비커 너비만큼 왼쪽으로
                  y: standPos.y - 50, // 받침대 위에 위치
                };
                console.log("Snap position:", snapPosition); // 디버깅

                shape.absolutePosition(snapPosition);
                shape.snapTarget = other;

                // 시각적 피드백
                shape.getLayer().batchDraw();
                return false; // forEach 루프 중단
              } else if (shape.snapTarget === other) {
                // 스냅 해제
                shape.snapTarget = null;
              }
            }
          });
        }

        // 용액 따르기 애니메이션 업데이트
        if (shape.container && shape.container.isPouring) {
          const liquid = shape.findOne(".liquid");
          if (liquid) {
            const fillHeight =
              (shape.container.currentVolume / shape.container.capacity) *
              shape.height();
            liquid.height(fillHeight);
            // liquid.y(shape.height() - fillHeight);
            liquid.fill(shape.container.color);
          }
        }

        layer.batchDraw();
      });

      shape.on("dragend", (e) => {
        // 스냅된 상태에서 용액 받기 시작
        if (shape.snapTarget && shape.container && shape.snapTarget.container) {
          console.log("비커가 뷰렛에 스냅됨"); // 디버깅용 로그만 남기고 자동 시작은 제거
        }
      });

      layer.add(shape);
      layer.draw();
      return shape; // shape 반환 추가
    }
  }

  // 시약 선택 시 동작
  document.querySelectorAll(".tool-item").forEach((item) => {
    item.addEventListener("click", () => {
      const type = item.getAttribute("data-tool");
      console.log("Selected tool:", type);

      if (SOLUTIONS[type]) {
        selectedSolution = type;
        showVolumeInputModal();
      } else {
        // 현재 보이는 화면의 중앙 좌표 계산
        const containerRect = stage.container().getBoundingClientRect();
        const viewportCenterX = containerRect.width / 2;
        const viewportCenterY = containerRect.height / 2;

        // 스테이지의 현재 위치와 스케일을 고려하여 실제 좌표 계산
        const centerX = (viewportCenterX - stage.x()) / stage.scaleX();
        const centerY = (viewportCenterY - stage.y()) / stage.scaleX();

        createTool(type, centerX, centerY);

        if (type === "ph-meter") {
          console.log("Activating pH meter");
          togglePHMeter(true);
        }
      }

      toolsModal.style.display = "none";
    });
  });

  // 용량 입력 모달 표시
  function showVolumeInputModal() {
    const volumeInputModal = document.getElementById("volumeInputModal");
    const volumeTitle = document.getElementById("volumeModalTitle");
    const volumeInput = document.getElementById("volumeInput");

    // 모달 제목 설정
    volumeTitle.textContent = `${SOLUTIONS[selectedSolution].name} 추가`;

    // 입력값 초기화
    volumeInput.value = "10";

    // 모달 표시
    volumeInputModal.style.display = "block";
  }

  // 모달 이벤트 리스너 설정
  document.getElementById("closeVolumeInput").addEventListener("click", () => {
    document.getElementById("volumeInputModal").style.display = "none";
    selectedSolution = null;
  });

  document.getElementById("cancelVolumeInput").addEventListener("click", () => {
    document.getElementById("volumeInputModal").style.display = "none";
    selectedSolution = null;
  });

  document
    .getElementById("confirmVolumeInput")
    .addEventListener("click", () => {
      const volume = parseFloat(document.getElementById("volumeInput").value);
      if (volume > 0) {
        enableContainerSelection(volume);
        document.getElementById("volumeInputModal").style.display = "none";
        document.body.style.cursor = "crosshair"; // 커서 스타일 변경
      }
    });

  // 용기 선택 모드 활성화
  function enableContainerSelection(volume) {
    let highlightedShape = null;
    let originalStroke = null;
    let originalStrokeWidth = null;

    // 마우스 이동 이벤트 핸들러
    const handleMouseMove = (e) => {
      const pos = stage.getPointerPosition();
      const shape = layer.getIntersection(pos);

      // 이전 하이라이트 제거
      if (highlightedShape) {
        highlightedShape.stroke(originalStroke);
        highlightedShape.strokeWidth(originalStrokeWidth);
        layer.draw();
        highlightedShape = null;
      }

      // 새로운 하이라이트 추가
      if (shape) {
        // Group을 찾을 때까지 부모로 올라가기
        let group = shape;
        while (group && !group.container) {
          group = group.parent;
        }

        if (group && group.container) {
          const containerShape = group.findOne("Path") || group.findOne("Rect");
          if (containerShape) {
            originalStroke = containerShape.stroke();
            originalStrokeWidth = containerShape.strokeWidth();

            containerShape.stroke("#6366f1");
            containerShape.strokeWidth(originalStrokeWidth + 2);
            layer.draw();
            highlightedShape = containerShape;
          }
        }
      }
    };

    const selectContainer = (e) => {
      const pos = stage.getPointerPosition();
      const shape = layer.getIntersection(pos);

      if (shape) {
        // Group을 찾을 때까지 부모로 올라가기
        let group = shape;
        while (group && !group.container) {
          group = group.parent;
        }

        if (group && group.container) {
          const container = group.container;

          // 용량 체크
          if (container.currentVolume + volume <= container.capacity) {
            // 시약 추가
            container.addSolution(selectedSolution, volume);

            // 시각적 업데이트
            const liquid = group.findOne(".liquid");
            if (liquid) {
              // 저장된 값들 사용
              const usableHeight = liquid.usableHeight;
              const liquidStartY = liquid.liquidStartY;

              // 현재 용량에 비례하여 높이 계산
              const fillHeight =
                (container.currentVolume / container.capacity) * usableHeight;

              // 액체 높이 설정 및 위치 조정 (아래에서 위로 자라나도록)
              liquid.height(fillHeight);
              liquid.fill(container.color);

              // 용액 정보 업데이트
              const infoText = group.findOne(".infoText");
              if (infoText) {
                infoText.text(container.getContentsInfo());
              }

              console.log("Updating liquid:", {
                currentVolume: container.currentVolume,
                capacity: container.capacity,
                usableHeight,
                fillHeight,
                startY: liquidStartY,
                newY: liquidStartY - fillHeight,
                color: container.color,
              });

              layer.draw();
            }
          } else {
            alert("용기의 용량을 초과합니다.");
          }

          // 이벤트 리스너 제거 및 커서 복구
          stage.off("mousemove", handleMouseMove);
          stage.off("click touchstart", selectContainer);

          // 하이라이트 제거하고 원래 스타일로 복구
          if (highlightedShape) {
            highlightedShape.stroke(originalStroke);
            highlightedShape.strokeWidth(originalStrokeWidth);
            layer.draw();
          }

          document.body.style.cursor = "default";
          selectedSolution = null;
        }
      }
    };

    // 스테이지에 이벤트 리스너 추가
    stage.on("mousemove", handleMouseMove);
    stage.on("click touchstart", selectContainer);
  }

  // 시뮬레이션 초기화
  function initSimulation() {
    Matter.Runner.run(engine);

    // Matter.js 렌더러 크기도 전체 화면으로 설정
    render.canvas.width = window.innerWidth;
    render.canvas.height = window.innerHeight;
    render.options.width = window.innerWidth;
    render.options.height = window.innerHeight;

    Matter.Render.run(render);
  }

  // 반응 속도 조절
  function toggleReactionSpeed() {
    const speedModal = document.getElementById("speedModal");
    speedModal.style.display = "block";
  }

  // 속도 조절 모달 관련 이벤트 리스너
  document.getElementById("closeSpeedModal").addEventListener("click", () => {
    document.getElementById("speedModal").style.display = "none";
  });

  // 속도 슬라이더 이벤트 리스너
  const speedSlider = document.querySelector(".speed-slider");
  const speedValue = document.querySelector(".speed-value");
  let tempSpeed = currentSpeed;

  speedSlider.addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    tempSpeed = value;
    speedValue.textContent = value.toFixed(1) + "x";
  });

  // 취소 버튼 클릭 이벤트
  document.getElementById("cancelSpeedInput").addEventListener("click", () => {
    document.getElementById("speedModal").style.display = "none";
    speedSlider.value = currentSpeed;
    speedValue.textContent = currentSpeed.toFixed(1) + "x";
  });

  // 확인 버튼 클릭 이벤트
  document.getElementById("confirmSpeedInput").addEventListener("click", () => {
    currentSpeed = tempSpeed;
    document.getElementById("speedModal").style.display = "none";
  });

  // 모달 외부 클릭 시 닫기
  window.addEventListener("click", (event) => {
    const speedModal = document.getElementById("speedModal");
    if (event.target === speedModal) {
      speedModal.style.display = "none";
      speedSlider.value = currentSpeed;
      speedValue.textContent = currentSpeed.toFixed(1) + "x";
    }
  });

  // 실행 취소
  function undoLastAction() {
    // 실행 취소 로직 구현 예정
  }

  // 줌인 버튼 클릭
  document
    .querySelector('[data-action="zoom"]')
    .addEventListener("click", () => {
      const scaleBy = 1.1;
      const oldScale = stage.scaleX();

      // 스테이지의 중앙점 계산
      const centerX = stage.width() / 2;
      const centerY = stage.height() / 2;

      // 현재 스테이지 위치에서의 중앙점
      const pointTo = {
        x: (centerX - stage.x()) / oldScale,
        y: (centerY - stage.y()) / oldScale,
      };

      const newScale = oldScale * scaleBy;

      // 새로운 위치 계산
      const newPos = {
        x: centerX - pointTo.x * newScale,
        y: centerY - pointTo.y * newScale,
      };

      stage.scale({ x: newScale, y: newScale });
      stage.position(newPos);
      stage.batchDraw();
    });

  // 줌아웃 버튼 클릭
  document
    .querySelector('[data-action="zoom-out"]')
    .addEventListener("click", () => {
      const scaleBy = 1.1;
      const oldScale = stage.scaleX();

      // 스테이지의 중앙점 계산
      const centerX = stage.width() / 2;
      const centerY = stage.height() / 2;

      // 현재 스테이지 위치에서의 중앙점
      const pointTo = {
        x: (centerX - stage.x()) / oldScale,
        y: (centerY - stage.y()) / oldScale,
      };

      const newScale = oldScale / scaleBy;

      // 새로운 위치 계산
      const newPos = {
        x: centerX - pointTo.x * newScale,
        y: centerY - pointTo.y * newScale,
      };

      stage.scale({ x: newScale, y: newScale });
      stage.position(newPos);
      stage.batchDraw();
    });

  // 마우스 휠 줌
  function toggleZoomMode() {
    stage.on("wheel", (e) => {
      e.evt.preventDefault();

      const scaleBy = 1.1;
      const oldScale = stage.scaleX();

      // 스테이지의 중앙점 계산
      const centerX = stage.width() / 2;
      const centerY = stage.height() / 2;

      // 현재 스테이지 위치에서의 중앙점
      const pointTo = {
        x: (centerX - stage.x()) / oldScale,
        y: (centerY - stage.y()) / oldScale,
      };

      // 마우스 휠 방향에 따라 확대/축소
      const newScale =
        e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;

      // 새로운 위치 계산
      const newPos = {
        x: centerX - pointTo.x * newScale,
        y: centerY - pointTo.y * newScale,
      };

      stage.scale({ x: newScale, y: newScale });
      stage.position(newPos);
      stage.batchDraw();
    });
  }

  // 데이터 그래프
  function toggleDataGraph() {
    // 그래프 표시 로직 구현 예정
  }

  // pH 미터 활성화/비활성화 함수
  function togglePHMeter(active) {
    console.log("Toggling pH meter:", active); // 디버깅
    isPHMeterActive = active;
    if (phPanel) {
      phPanel.style.display = active ? "block" : "none";
      if (!active) {
        currentPH = null;
        if (phValue) {
          phValue.textContent = "--.--";
        }
      }
    } else {
      console.error("phPanel not found!"); // 디버깅
    }
  }

  // pH 패널 닫기 버튼 이벤트
  closePhPanel.addEventListener("click", () => {
    togglePHMeter(false);
  });

  // pH 값 계산 함수
  function calculatePH(solution) {
    // 용액의 H+ 이온 농도를 기반으로 pH 계산
    if (solution.type === "acid") {
      return -Math.log10(solution.concentration);
    } else if (solution.type === "base") {
      return 14 + Math.log10(solution.concentration);
    } else {
      return 7; // 중성
    }
  }

  // pH 값 업데이트 함수
  function updatePHValue(value) {
    currentPH = value;
    phValue.textContent = value.toFixed(2);

    // pH 값에 따른 시각적 피드백
    const scaleGradient = document.querySelector(".scale-gradient");
    if (value < 7) {
      const percentage = (value / 7) * 50; // 0-7 범위를 0-50%로 매핑
      scaleGradient.style.background = `linear-gradient(to right, 
        #ff4444 ${percentage}%, 
        #ffff44 50%,
        #4444ff 100%
      )`;
    } else if (value > 7) {
      const percentage = ((value - 7) / 7) * 50 + 50; // 7-14 범위를 50-100%로 매핑
      scaleGradient.style.background = `linear-gradient(to right, 
        #ff4444 0%, 
        #ffff44 50%,
        #4444ff ${percentage}%
      )`;
    } else {
      scaleGradient.style.background = `linear-gradient(to right, 
        #ff4444 0%, 
        #ffff44 50%,
        #4444ff 100%
      )`;
    }
  }

  // 용액 혼합 시 pH 변화 감지 함수
  function onSolutionMix(solution1, solution2) {
    if (!isPHMeterActive) return;

    // 두 용액의 농도와 부피를 고려하여 최종 pH 계산
    const totalVolume = solution1.volume + solution2.volume;
    const solution1Moles = solution1.concentration * solution1.volume;
    const solution2Moles = solution2.concentration * solution2.volume;

    // 산-염기 중화 반응 고려
    if (
      (solution1.type === "acid" && solution2.type === "base") ||
      (solution1.type === "base" && solution2.type === "acid")
    ) {
      const finalMoles = Math.abs(solution1Moles - solution2Moles);
      const finalConcentration = finalMoles / totalVolume;

      if (solution1Moles > solution2Moles) {
        updatePHValue(
          calculatePH({ type: "acid", concentration: finalConcentration })
        );
      } else if (solution1Moles < solution2Moles) {
        updatePHValue(
          calculatePH({ type: "base", concentration: finalConcentration })
        );
      } else {
        updatePHValue(7); // 완전 중화
      }
    }
  }
});
