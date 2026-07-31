BUILD_DIR := build/release
FINAL_PDF := build/moonweave-technical-report.pdf

.PHONY: all qa clean

all:
	mkdir -p $(BUILD_DIR)
	latexmk -xelatex -halt-on-error -outdir=$(BUILD_DIR) main.tex
	cp $(BUILD_DIR)/main.pdf $(FINAL_PDF)

qa: all
	./scripts/validate.sh

clean:
	latexmk -C -outdir=$(BUILD_DIR) main.tex

